//! Sound-Modul für Erinnerungs-Sounds in Bluelight Hub
//!
//! Nutzt rodio für plattformübergreifende Audio-Wiedergabe.
//! Funktioniert auch bei minimierter App, da der Sound im Tauri-Backend abgespielt wird.
//!
//! Sound-Dateien werden aus dem resources-Verzeichnis geladen.
//! Fallback: Generiert einen einfachen Beep-Ton wenn keine Datei vorhanden ist.
//!
//! Security Features:
//! - Path Traversal Protection: Nur erlaubte Dateinamen ohne Pfad-Komponenten
//! - Concurrent Sound Limit: Max 5 gleichzeitige Sounds (Thread-Leak Prevention)
//! - Volume Validation: Nur finite Werte zwischen 0.0 und 1.0
//! - File Size Limit: Max 10MB pro Sound-Datei
//! - Information Disclosure Prevention: Keine vollständigen Pfade in Fehlermeldungen

use rodio::source::{SineWave, Source};
use rodio::{Decoder, OutputStream, Sink};
use std::fs::{self, File};
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// Maximale Anzahl gleichzeitig laufender Sound-Threads (Thread-Leak Prevention)
const MAX_CONCURRENT_SOUNDS: usize = 5;

/// Maximale Dateigröße für Sound-Dateien in Bytes (10MB)
const MAX_SOUND_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// Erlaubte Dateiendungen für Sound-Dateien (Whitelist)
const ALLOWED_EXTENSIONS: &[&str] = &["wav", "mp3", "ogg", "flac"];

/// Globaler Counter für aktive Sound-Threads
static ACTIVE_SOUND_THREADS: AtomicUsize = AtomicUsize::new(0);

/// RAII Guard für Sound-Thread Counter (automatisches Decrement bei Drop)
struct SoundThreadGuard;

impl Drop for SoundThreadGuard {
    fn drop(&mut self) {
        ACTIVE_SOUND_THREADS.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Validiert und bereinigt einen Sound-Dateinamen gegen Path Traversal Angriffe
///
/// # Sicherheitsprüfungen:
/// - Blockiert Path Traversal (`..`, `/`, `\`)
/// - Whitelist für erlaubte Dateiendungen (wav, mp3, ogg, flac)
/// - Canonicalize-Check dass resultierender Pfad innerhalb sounds/ bleibt
///
/// # Returns
/// - `Ok(PathBuf)` wenn der Pfad sicher ist
/// - `Err(String)` bei ungültigem oder unsicherem Pfad
fn sanitize_sound_file_path(
    app_handle: &AppHandle,
    sound_file: &str,
) -> Result<PathBuf, String> {
    // Trim führende Slashes für konsistente Verarbeitung
    let cleaned = sound_file.trim_start_matches('/');

    // Block Path Traversal: Keine ".." erlaubt
    if cleaned.contains("..") {
        log::warn!("Path Traversal Versuch blockiert: enthält '..'");
        return Err("Ungültiger Dateiname".to_string());
    }

    // Block Path Separators: Nur einfache Dateinamen erlaubt
    if cleaned.contains('/') || cleaned.contains('\\') {
        log::warn!("Path Traversal Versuch blockiert: enthält Pfadseparatoren");
        return Err("Ungültiger Dateiname: nur Dateinamen ohne Pfad erlaubt".to_string());
    }

    // Extension Whitelist Check
    let extension = std::path::Path::new(cleaned)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

    let has_valid_extension = extension
        .as_ref()
        .map(|ext| ALLOWED_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false);

    if !has_valid_extension {
        log::warn!(
            "Ungültige Dateiendung blockiert. Erlaubt: {:?}",
            ALLOWED_EXTENSIONS
        );
        return Err(format!(
            "Ungültige Dateiendung. Erlaubt: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // Basis-Pfad für Sounds
    let sounds_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|_| "Konnte Resource-Verzeichnis nicht ermitteln")?
        .join("sounds");

    let target_path = sounds_dir.join(cleaned);

    // Canonicalize beide Pfade für sicheren Vergleich
    // Note: canonicalize benötigt existierende Dateien, daher prüfen wir hier
    // ob der Pfad mit dem sounds_dir beginnt
    if !target_path.exists() {
        return Err("Sound-Datei nicht gefunden".to_string());
    }

    let canonical_target = target_path
        .canonicalize()
        .map_err(|_| "Konnte Pfad nicht auflösen")?;

    let canonical_sounds_dir = sounds_dir
        .canonicalize()
        .map_err(|_| "Konnte sounds-Verzeichnis nicht auflösen")?;

    // Sicherstellen dass der Ziel-Pfad innerhalb des sounds-Verzeichnisses liegt
    if !canonical_target.starts_with(&canonical_sounds_dir) {
        log::warn!("Path Traversal Versuch blockiert: Pfad außerhalb sounds/");
        return Err("Ungültiger Pfad".to_string());
    }

    Ok(canonical_target)
}

/// Validiert den Volume-Parameter
///
/// # Sicherheitsprüfungen:
/// - Muss finite sein (kein NaN, kein Infinity)
/// - Muss zwischen 0.0 und 1.0 liegen
///
/// # Returns
/// - `Ok(f32)` validierter Volume-Wert
/// - `Err(String)` bei ungültigem Wert
fn validate_volume(volume: Option<f32>) -> Result<f32, String> {
    let vol = volume.unwrap_or(1.0);

    if !vol.is_finite() {
        return Err("Volume muss ein gültiger Wert sein (kein NaN oder Infinity)".to_string());
    }

    if vol < 0.0 || vol > 1.0 {
        return Err("Volume muss zwischen 0.0 und 1.0 liegen".to_string());
    }

    Ok(vol)
}

/// Prüft ob ein neuer Sound-Thread gestartet werden kann (Concurrent Limit)
///
/// # Returns
/// - `Ok(())` wenn ein neuer Thread gestartet werden kann
/// - `Err(String)` wenn das Limit erreicht ist
fn try_acquire_sound_thread() -> Result<(), String> {
    let current = ACTIVE_SOUND_THREADS.fetch_add(1, Ordering::SeqCst);

    if current >= MAX_CONCURRENT_SOUNDS {
        // Rollback: Decrement da wir keinen Thread starten
        ACTIVE_SOUND_THREADS.fetch_sub(1, Ordering::SeqCst);
        return Err(format!(
            "Zu viele gleichzeitige Sounds (max {}). Bitte warten.",
            MAX_CONCURRENT_SOUNDS
        ));
    }

    Ok(())
}

/// Verfügbare Sound-Typen für Erinnerungen
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SoundType {
    /// Standard Erinnerungs-Sound (mittlere Frequenz, 2 kurze Töne)
    Reminder,
    /// Dringender Alarm-Sound (hohe Frequenz, schnelle Wiederholung)
    Urgent,
    /// Sanfter Hinweis-Sound (niedrige Frequenz, 1 langer Ton)
    Gentle,
}

impl SoundType {
    /// Parst den Sound-Typ aus einem String
    ///
    /// Unterstützt sowohl neue Level-Namen (info, warning, urgent)
    /// als auch Legacy-Namen (reminder, gentle) für Abwärtskompatibilität.
    fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            // Neue Level-Namen (Story 2.7)
            "info" => Some(Self::Gentle),     // Info = dezent = Gentle
            "warning" => Some(Self::Reminder), // Warning = mittel = Reminder
            "urgent" => Some(Self::Urgent),   // Urgent = dringend = Urgent
            // Legacy-Namen (Abwärtskompatibilität)
            "reminder" => Some(Self::Reminder),
            "gentle" => Some(Self::Gentle),
            _ => None,
        }
    }

    /// Gibt den Dateinamen für diesen Sound-Typ zurück
    fn filename(&self) -> &'static str {
        match self {
            Self::Reminder => "reminder.wav",
            Self::Urgent => "urgent.wav",
            Self::Gentle => "gentle.wav",
        }
    }

    /// Gibt Frequenz und Dauer für den Fallback-Beep zurück
    fn beep_params(&self) -> (f32, u64, u32) {
        // (Frequenz in Hz, Dauer pro Ton in ms, Anzahl Wiederholungen)
        match self {
            Self::Reminder => (800.0, 200, 2), // Mittel, 2x kurz
            Self::Urgent => (1200.0, 100, 4),  // Hoch, 4x sehr kurz
            Self::Gentle => (440.0, 500, 1),   // Niedrig, 1x lang
        }
    }
}

/// Versucht die Sound-Datei aus dem resources-Verzeichnis zu laden
///
/// # Sicherheit
/// - Loggt nur Dateinamen, keine vollständigen Pfade (Information Disclosure Prevention)
fn try_load_sound_file(app_handle: &AppHandle, sound_type: SoundType) -> Option<PathBuf> {
    let resource_path = app_handle
        .path()
        .resource_dir()
        .ok()?
        .join("sounds")
        .join(sound_type.filename());

    if resource_path.exists() {
        Some(resource_path)
    } else {
        // Note: Nur Dateiname loggen, nicht Full-Path (Information Disclosure Prevention)
        log::warn!(
            "Sound-Datei nicht gefunden: {}, nutze Fallback-Beep",
            sound_type.filename()
        );
        None
    }
}

/// Spielt einen generierten Beep-Ton ab (Fallback wenn keine Sound-Datei)
///
/// # Parameter
/// - `sound_type`: Typ des Sounds (bestimmt Frequenz und Dauer)
/// - `stream_handle`: Audio-Output Handle
/// - `volume`: Lautstärke (0.0-1.0), Standard ist 0.3
fn play_beep(sound_type: SoundType, stream_handle: &rodio::OutputStreamHandle, volume: f32) {
    let (freq, duration_ms, repeats) = sound_type.beep_params();

    let sink = match Sink::try_new(stream_handle) {
        Ok(sink) => sink,
        Err(e) => {
            log::error!("Konnte Audio-Sink nicht erstellen: {}", e);
            return;
        }
    };

    // Volume-Control (Story 2.7 AC3)
    let effective_volume = volume.clamp(0.0, 1.0) * 0.3; // Max 0.3 für Beeps
    sink.set_volume(effective_volume);

    for i in 0..repeats {
        let source = SineWave::new(freq)
            .take_duration(Duration::from_millis(duration_ms))
            .amplify(1.0); // Volume über Sink gesteuert

        sink.append(source);

        // Kurze Pause zwischen Tönen (außer beim letzten)
        if i < repeats - 1 {
            let silence = SineWave::new(0.0)
                .take_duration(Duration::from_millis(100))
                .amplify(0.0);
            sink.append(silence);
        }
    }

    sink.sleep_until_end();
}

/// Spielt eine WAV- oder MP3-Datei ab
///
/// # Parameter
/// - `path`: Pfad zur Sound-Datei (bereits validiert)
/// - `stream_handle`: Audio-Output Handle
/// - `volume`: Lautstärke (0.0-1.0), Standard ist 1.0
///
/// # Sicherheit
/// - File Size Limit: Max 10MB
/// - Keine Full-Paths in Fehlermeldungen (Information Disclosure Prevention)
fn play_sound_file(
    path: PathBuf,
    stream_handle: &rodio::OutputStreamHandle,
    volume: f32,
) -> Result<(), String> {
    // File Size Check (Security: Prevent DoS through large files)
    let metadata = fs::metadata(&path).map_err(|_| "Konnte Datei-Metadaten nicht lesen")?;

    if metadata.len() > MAX_SOUND_FILE_SIZE {
        let size_mb = metadata.len() / (1024 * 1024);
        let max_mb = MAX_SOUND_FILE_SIZE / (1024 * 1024);
        log::warn!(
            "Sound-Datei zu groß: {}MB (max {}MB)",
            size_mb,
            max_mb
        );
        return Err(format!(
            "Sound-Datei zu groß (max {}MB erlaubt)",
            max_mb
        ));
    }

    // Note: Keine Pfade in Fehlermeldungen (Information Disclosure Prevention)
    let file = File::open(&path).map_err(|_| "Konnte Sound-Datei nicht öffnen")?;
    let reader = BufReader::new(file);

    let source =
        Decoder::new(reader).map_err(|_| "Konnte Sound nicht dekodieren (ungültiges Format?)")?;

    let sink = Sink::try_new(stream_handle)
        .map_err(|_| "Konnte Audio-Sink nicht erstellen")?;

    // Volume-Control (Story 2.7 AC3)
    sink.set_volume(volume.clamp(0.0, 1.0));

    sink.append(source);
    sink.sleep_until_end();

    Ok(())
}

/// Spielt einen Sound ab (blockiert nicht den Aufrufer)
///
/// # Parameter
/// - `app_handle`: Tauri AppHandle für Resource-Zugriff
/// - `sound_type`: Typ des Sounds
/// - `volume`: Lautstärke (0.0-1.0) - bereits validiert
/// - `custom_file`: Optionaler sanitized Pfad zu einer Custom Sound-Datei
///
/// # Sicherheit
/// - Thread-Limit: Max 5 gleichzeitige Sounds
/// - Volume wurde bereits in play_sound validiert
/// - Custom-File wurde bereits durch sanitize_sound_file_path validiert
fn play_sound_internal(
    app_handle: AppHandle,
    sound_type: SoundType,
    volume: f32,
    custom_file: Option<PathBuf>,
) -> Result<(), String> {
    // Thread-Limit Check (Security: Thread-Leak Prevention)
    try_acquire_sound_thread()?;

    // Entweder Custom-File (bereits validiert) oder Standard-File verwenden
    let sound_file = custom_file.or_else(|| try_load_sound_file(&app_handle, sound_type));

    // Sound in separatem Thread abspielen um nicht zu blockieren
    thread::spawn(move || {
        // RAII Guard: Decrement Counter wenn Thread endet (egal wie)
        let _guard = SoundThreadGuard;

        // OutputStream muss im gleichen Thread wie Sink leben
        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(output) => output,
            Err(e) => {
                log::error!("Konnte Audio-Output nicht initialisieren: {}", e);
                return;
            }
        };

        match sound_file {
            Some(path) => {
                if let Err(e) = play_sound_file(path, &stream_handle, volume) {
                    log::warn!(
                        "Fehler beim Abspielen der Sound-Datei: {}, nutze Fallback",
                        e
                    );
                    play_beep(sound_type, &stream_handle, volume);
                }
            }
            None => {
                play_beep(sound_type, &stream_handle, volume);
            }
        }

        log::info!("Sound {:?} @ {:.0}% erfolgreich abgespielt", sound_type, volume * 100.0);
    });

    Ok(())
}

/// Tauri Command: Spielt einen Sound basierend auf dem Typ ab
///
/// # Parameter
/// - `sound_type`: String der den Sound-Typ identifiziert ("info", "warning", "urgent", oder Legacy: "reminder", "gentle")
/// - `volume`: Optionale Lautstärke (0.0-1.0), Standard ist 1.0
/// - `sound_file`: Optionaler Dateiname einer Custom Sound-Datei (NUR Dateiname, keine Pfade!)
///
/// # Rückgabe
/// - `Ok(())` wenn der Sound erfolgreich gestartet wurde
/// - `Err(String)` bei unbekanntem Sound-Typ, ungültigem Volume, oder ungültigem Dateinamen
///
/// # Sicherheit
/// - Volume wird auf finite Werte zwischen 0.0-1.0 validiert
/// - sound_file wird gegen Path Traversal geschützt (nur Dateinamen, keine Pfade)
/// - Erlaubte Extensions: wav, mp3, ogg, flac
/// - Maximale Dateigröße: 10MB
/// - Maximale gleichzeitige Sounds: 5
///
/// # Beispiel (TypeScript)
/// ```typescript
/// // Standard-Sound
/// await invoke('play_sound', { soundType: 'info' });
///
/// // Mit Volume (Story 2.7 AC3)
/// await invoke('play_sound', { soundType: 'warning', volume: 0.85 });
///
/// // Mit Custom Sound (Story 2.7 AC2)
/// // WICHTIG: Nur Dateiname, kein Pfad!
/// await invoke('play_sound', {
///   soundType: 'urgent',
///   volume: 1.0,
///   soundFile: 'alarm-urgent-chime.mp3'
/// });
/// ```
#[tauri::command]
pub fn play_sound(
    app_handle: AppHandle,
    sound_type: String,
    volume: Option<f32>,
    sound_file: Option<String>,
) -> Result<(), String> {
    // Security Issue 3: Volume Validation BEVOR Thread gestartet wird
    let vol = validate_volume(volume)?;

    // Security Issue 1: Path Traversal Protection für Custom Sound Files
    let sanitized_path = match &sound_file {
        Some(file) => Some(sanitize_sound_file_path(&app_handle, file)?),
        None => None,
    };

    // Note: Keine Full-Paths in Logs (Information Disclosure Prevention)
    log::info!(
        "play_sound aufgerufen mit Typ: {}, Volume: {:.0}%, Custom: {}",
        sound_type,
        vol * 100.0,
        sound_file.as_deref().unwrap_or("(none)")
    );

    let parsed_type = SoundType::from_str(&sound_type).ok_or_else(|| {
        format!(
            "Unbekannter Sound-Typ: '{}'. Erlaubt: info, warning, urgent (oder Legacy: reminder, gentle)",
            sound_type
        )
    })?;

    play_sound_internal(app_handle, parsed_type, vol, sanitized_path)
}

/// Tauri Command: Testet ob Audio-Wiedergabe funktioniert
///
/// Nützlich für Debugging und Initialisierung
#[tauri::command]
pub fn test_audio() -> Result<String, String> {
    log::info!("Audio-Test gestartet");

    match OutputStream::try_default() {
        Ok(_) => {
            log::info!("Audio-System verfügbar");
            Ok("Audio-System ist verfügbar".to_string())
        }
        Err(e) => {
            let msg = format!("Audio-System nicht verfügbar: {}", e);
            log::error!("{}", msg);
            Err(msg)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sound_type_parsing() {
        assert_eq!(SoundType::from_str("reminder"), Some(SoundType::Reminder));
        assert_eq!(SoundType::from_str("REMINDER"), Some(SoundType::Reminder));
        assert_eq!(SoundType::from_str("urgent"), Some(SoundType::Urgent));
        assert_eq!(SoundType::from_str("gentle"), Some(SoundType::Gentle));
        assert_eq!(SoundType::from_str("unknown"), None);
    }

    // Security Tests für Volume Validation (Issue 3)
    #[test]
    fn test_volume_validation_valid() {
        assert!(validate_volume(Some(0.0)).is_ok());
        assert!(validate_volume(Some(0.5)).is_ok());
        assert!(validate_volume(Some(1.0)).is_ok());
        assert!(validate_volume(None).is_ok()); // Default 1.0
    }

    #[test]
    fn test_volume_validation_invalid_nan() {
        assert!(validate_volume(Some(f32::NAN)).is_err());
    }

    #[test]
    fn test_volume_validation_invalid_infinity() {
        assert!(validate_volume(Some(f32::INFINITY)).is_err());
        assert!(validate_volume(Some(f32::NEG_INFINITY)).is_err());
    }

    #[test]
    fn test_volume_validation_out_of_range() {
        assert!(validate_volume(Some(-0.1)).is_err());
        assert!(validate_volume(Some(1.1)).is_err());
        assert!(validate_volume(Some(-100.0)).is_err());
        assert!(validate_volume(Some(100.0)).is_err());
    }

    // Security Tests für Thread-Limit (Issue 2)
    #[test]
    fn test_thread_limit_counter() {
        // Reset counter für Test-Isolation
        ACTIVE_SOUND_THREADS.store(0, Ordering::SeqCst);

        // Sollte OK sein bis MAX_CONCURRENT_SOUNDS
        for _ in 0..MAX_CONCURRENT_SOUNDS {
            assert!(try_acquire_sound_thread().is_ok());
        }

        // Nächster Aufruf sollte fehlschlagen
        assert!(try_acquire_sound_thread().is_err());

        // Reset für andere Tests
        ACTIVE_SOUND_THREADS.store(0, Ordering::SeqCst);
    }

    #[test]
    fn test_sound_thread_guard_decrements() {
        ACTIVE_SOUND_THREADS.store(0, Ordering::SeqCst);

        {
            let _guard = SoundThreadGuard;
            ACTIVE_SOUND_THREADS.fetch_add(1, Ordering::SeqCst);
            assert_eq!(ACTIVE_SOUND_THREADS.load(Ordering::SeqCst), 1);
        }
        // Guard wurde gedroppt, Counter sollte 0 sein
        assert_eq!(ACTIVE_SOUND_THREADS.load(Ordering::SeqCst), 0);
    }
}
