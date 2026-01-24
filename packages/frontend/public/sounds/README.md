# Sound Assets für Erinnerungs-Alarme

Dieses Verzeichnis enthält die Audio-Dateien für die Alarm-Töne.

## Benötigte Dateien

Das System benötigt 12 MP3-Dateien (3 Level × 4 Sound-Optionen):

### Info-Alarm (Standard-Erinnerungen)
- `alarm-info-default.mp3` - Standard-Info-Ton
- `alarm-info-chime.mp3` - Glockenspiel
- `alarm-info-bell.mp3` - Klingel
- `alarm-info-alert.mp3` - Kurzer Signalton

### Warning-Alarm (Eskalation nach 30s)
- `alarm-warning-default.mp3` - Standard-Warning-Ton
- `alarm-warning-chime.mp3` - Glockenspiel (intensiver)
- `alarm-warning-bell.mp3` - Klingel (intensiver)
- `alarm-warning-alert.mp3` - Signalton (intensiver)

### Urgent-Alarm (Eskalation nach 60s)
- `alarm-urgent-default.mp3` - Standard-Urgent-Ton
- `alarm-urgent-chime.mp3` - Glockenspiel (dringend)
- `alarm-urgent-bell.mp3` - Klingel (dringend)
- `alarm-urgent-alert.mp3` - Signalton (dringend)

## Fallback-Verhalten

Wenn Sound-Dateien fehlen:
- **Desktop (Tauri):** Das Rust-Backend generiert synthetische Beep-Töne
- **Browser (Testing):** Graceful Degradation mit Console-Log

## Empfohlene Audio-Spezifikationen

- **Format:** MP3 (für Web-Kompatibilität)
- **Sample Rate:** 44.1 kHz
- **Channels:** Mono oder Stereo
- **Duration:** 0.5-2 Sekunden
- **Volume:** Normalisiert auf -12 dB

## Sound-Charakteristiken pro Level

| Level | Frequenzbereich | Tempo | Charakter |
|-------|-----------------|-------|-----------|
| Info | 400-800 Hz | Langsam | Dezent, freundlich |
| Warning | 600-1000 Hz | Mittel | Aufmerksamkeit erregend |
| Urgent | 800-1200 Hz | Schnell | Dringend, nicht zu ignorieren |

## Freie Sound-Ressourcen

- [Freesound.org](https://freesound.org) - Creative Commons Sounds
- [Mixkit](https://mixkit.co/free-sound-effects/) - Kostenlose Sound-Effekte
- [Notification Sounds](https://notificationsounds.com) - Benachrichtigungstöne
