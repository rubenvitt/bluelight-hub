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
    /// Standard Erinnerungs-Sound (mittlere Frequenz, 2 kurze Töne)
    Reminder,
    /// Dringender Alarm-Sound (hohe Frequenz, schnelle Wiederholung)
    Urgent,
    /// Sanfter Hinweis-Sound (niedrige Frequenz, 1 langer Ton)
    Gentle,
}

impl SoundType {
    /// Parst den Sound-Typ aus einem String
    fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "reminder" => Some(Self::Reminder),
            "urgent" => Some(Self::Urgent),
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
        log::warn!(
            "Sound-Datei nicht gefunden: {:?}, nutze Fallback-Beep",
            resource_path
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

/// Spielt eine WAV-Datei ab
fn play_wav_file(path: PathBuf, stream_handle: &rodio::OutputStreamHandle) -> Result<(), String> {
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
fn play_sound_internal(app_handle: AppHandle, sound_type: SoundType) -> Result<(), String> {
    let sound_file = try_load_sound_file(&app_handle, sound_type);

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

        match sound_file {
            Some(path) => {
                if let Err(e) = play_wav_file(path, &stream_handle) {
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
/// - `sound_type`: String der den Sound-Typ identifiziert ("reminder", "urgent", "gentle")
///
/// # Rückgabe
/// - `Ok(())` wenn der Sound erfolgreich gestartet wurde
/// - `Err(String)` bei unbekanntem Sound-Typ oder Fehler
///
/// # Beispiel (TypeScript)
/// ```typescript
/// await invoke('play_sound', { soundType: 'reminder' });
/// ```
#[tauri::command]
pub fn play_sound(app_handle: AppHandle, sound_type: String) -> Result<(), String> {
    log::info!("play_sound aufgerufen mit Typ: {}", sound_type);

    let parsed_type = SoundType::from_str(&sound_type).ok_or_else(|| {
        format!(
            "Unbekannter Sound-Typ: '{}'. Erlaubt: reminder, urgent, gentle",
            sound_type
        )
    })?;

    play_sound_internal(app_handle, parsed_type)
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
}
