//! Sound-Modul für Erinnerungs-Sounds in Bluelight Hub
//!
//! Nutzt rodio für plattformübergreifende Audio-Wiedergabe.
//! Funktioniert auch bei minimierter App, da der Sound im Tauri-Backend abgespielt wird.
//!
//! Sound-Dateien werden aus dem resources-Verzeichnis geladen.
//! Fallback: Generiert einen einfachen Beep-Ton wenn keine Datei vorhanden ist.

use rodio::source::{SineWave, Source};
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// Verfügbare Sound-Typen für Erinnerungen
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SoundType {
    /// Info-Level (ehemals Reminder/Gentle)
    Info,
    /// Warnung-Level
    Warning,
    /// Dringender Alarm-Level
    Urgent,
}

impl SoundType {
    /// Parst den Sound-Typ aus einem String
    fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "info" => Some(Self::Info),
            "warning" => Some(Self::Warning),
            "urgent" => Some(Self::Urgent),
            // Legacy Mappings
            "reminder" => Some(Self::Info),
            "gentle" => Some(Self::Info),
            _ => None,
        }
    }

    /// Gibt den Standard-Dateinamen für diesen Sound-Typ zurück
    fn default_filename(&self) -> &'static str {
        match self {
            Self::Info => "alarm-info-default.mp3",
            Self::Warning => "alarm-warning-default.mp3",
            Self::Urgent => "alarm-urgent-default.mp3",
        }
    }

    /// Gibt Frequenz und Dauer für den Fallback-Beep zurück
    fn beep_params(&self) -> (f32, u64, u32) {
        // (Frequenz in Hz, Dauer pro Ton in ms, Anzahl Wiederholungen)
        match self {
            Self::Info => (440.0, 500, 1),    // Niedrig, 1x lang
            Self::Warning => (800.0, 200, 2), // Mittel, 2x kurz
            Self::Urgent => (1200.0, 100, 4), // Hoch, 4x sehr kurz
        }
    }
}

/// Versucht die Sound-Datei zu laden
///
/// `custom_file`: Optionaler Pfad (z.B. "/sounds/alarm-info-chime.mp3")
fn try_resolve_sound_file(
    app_handle: &AppHandle,
    sound_type: SoundType,
    custom_file: Option<String>,
) -> Option<PathBuf> {
    let filename = if let Some(file_path) = custom_file {
        // Wenn Pfad "/sounds/..." ist, extrahieren wir den Dateinamen
        if let Some(name) = PathBuf::from(&file_path).file_name() {
            name.to_string_lossy().to_string()
        } else {
            file_path
        }
    } else {
        sound_type.default_filename().to_string()
    };

    let resource_path = app_handle
        .path()
        .resource_dir()
        .ok()?
        .join("sounds")
        .join(&filename);

    if resource_path.exists() {
        Some(resource_path)
    } else {
        log::warn!(
            "Sound-Datei nicht gefunden: {:?} (Basis: {:?}), nutze Fallback-Beep",
            resource_path,
            filename
        );
        None
    }
}

/// Spielt einen generierten Beep-Ton ab (Fallback wenn keine Sound-Datei)
fn play_beep(sound_type: SoundType, stream_handle: &rodio::OutputStreamHandle) {
    let (freq, duration_ms, repeats) = sound_type.beep_params();

    let sink = match Sink::try_new(stream_handle) {
        Ok(sink) => sink,
        Err(e) => {
            log::error!("Konnte Audio-Sink nicht erstellen: {}", e);
            return;
        }
    };

    for i in 0..repeats {
        let source = SineWave::new(freq)
            .take_duration(Duration::from_millis(duration_ms))
            .amplify(0.3); // Nicht zu laut

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

/// Spielt eine Audio-Datei (WAV/MP3) ab
fn play_audio_file(path: PathBuf, stream_handle: &rodio::OutputStreamHandle) -> Result<(), String> {
    let file = File::open(&path).map_err(|e| format!("Konnte Datei nicht öffnen: {}", e))?;
    let reader = BufReader::new(file);

    let source =
        Decoder::new(reader).map_err(|e| format!("Konnte Sound nicht dekodieren: {}", e))?;

    let sink = Sink::try_new(stream_handle)
        .map_err(|e| format!("Konnte Audio-Sink nicht erstellen: {}", e))?;

    sink.append(source);
    sink.sleep_until_end();

    Ok(())
}

/// Spielt einen Sound ab (blockiert nicht den Aufrufer)
fn play_sound_internal(
    app_handle: AppHandle,
    sound_type: SoundType,
    custom_file: Option<String>,
) -> Result<(), String> {
    let sound_path = try_resolve_sound_file(&app_handle, sound_type, custom_file);

    // Sound in separatem Thread abspielen um nicht zu blockieren
    thread::spawn(move || {
        // OutputStream muss im gleichen Thread wie Sink leben
        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(output) => output,
            Err(e) => {
                log::error!("Konnte Audio-Output nicht initialisieren: {}", e);
                return;
            }
        };

        match sound_path {
            Some(path) => {
                if let Err(e) = play_audio_file(path, &stream_handle) {
                    log::warn!(
                        "Fehler beim Abspielen der Sound-Datei: {}, nutze Fallback",
                        e
                    );
                    play_beep(sound_type, &stream_handle);
                }
            }
            None => {
                play_beep(sound_type, &stream_handle);
            }
        }

        log::info!("Sound {:?} erfolgreich abgespielt", sound_type);
    });

    Ok(())
}

/// Tauri Command: Spielt einen Sound basierend auf dem Typ ab
///
/// # Parameter
/// - `sound_type`: "info", "warning", "urgent"
/// - `sound_file`: Optionaler Pfad zur Sound-Datei (z.B. "/sounds/alarm-info-chime.mp3")
///
/// # Rückgabe
/// - `Ok(())` wenn der Sound erfolgreich gestartet wurde
/// - `Err(String)` bei unbekanntem Sound-Typ oder Fehler
#[tauri::command]
pub fn play_sound(
    app_handle: AppHandle,
    sound_type: String,
    sound_file: Option<String>,
) -> Result<(), String> {
    log::info!(
        "play_sound aufgerufen mit Typ: {}, File: {:?}",
        sound_type,
        sound_file
    );

    let parsed_type = SoundType::from_str(&sound_type).ok_or_else(|| {
        format!(
            "Unbekannter Sound-Typ: '{}'. Erlaubt: info, warning, urgent",
            sound_type
        )
    })?;

    play_sound_internal(app_handle, parsed_type, sound_file)
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
        assert_eq!(SoundType::from_str("info"), Some(SoundType::Info));
        assert_eq!(SoundType::from_str("INFO"), Some(SoundType::Info));
        assert_eq!(SoundType::from_str("warning"), Some(SoundType::Warning));
        assert_eq!(SoundType::from_str("urgent"), Some(SoundType::Urgent));
        // Legacy Mappings
        assert_eq!(SoundType::from_str("reminder"), Some(SoundType::Info));
        assert_eq!(SoundType::from_str("gentle"), Some(SoundType::Info));
        assert_eq!(SoundType::from_str("unknown"), None);
    }
}
