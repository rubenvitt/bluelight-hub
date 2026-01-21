use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIconId},
    AppHandle, Emitter, Manager, Runtime,
};

/// Tray-Icon ID für späteren Zugriff
pub const TRAY_ID: &str = "main-tray";

/// Standard-Tooltip ohne Badge
const DEFAULT_TOOLTIP: &str = "Bluelight Hub";

/// Erstellt das System-Tray mit Menu und Event-Handlern.
///
/// AC1/AC2: Tray zeigt Badge bei ausgelösten Erinnerungen, neutral ohne Alarme.
/// AC3: Click öffnet App mit Fokus.
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Menu Items erstellen
    let open_item = MenuItem::with_id(app, "open", "Öffnen", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;

    // Menu zusammenstellen (Tauri 2.x MenuBuilder API)
    let menu = MenuBuilder::new(app)
        .items(&[&open_item, &quit_item])
        .build()?;

    // Tray Icon erstellen
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().ok_or("Kein Default-Icon konfiguriert")?.clone())
        .tooltip("Bluelight Hub")
        .menu(&menu)
        .show_menu_on_left_click(false) // Left-Click öffnet App, nicht Menu
        .on_menu_event(|app, event| {
            log::info!("Tray menu event: {:?}", event.id());
            match event.id().as_ref() {
                "open" => {
                    show_and_focus_window(app);
                }
                "quit" => {
                    log::info!("App wird beendet via Tray-Menu");
                    app.exit(0);
                }
                _ => {
                    log::warn!("Unbekanntes Menu-Event: {:?}", event.id());
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            // AC3: Tray-Click öffnet App mit Fokus
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                log::info!("Tray icon left-click");
                let app = tray.app_handle();
                show_and_focus_window(app);

                // Event emittieren für Frontend-Navigation (Story 1.9 AC3)
                if let Err(e) = app.emit("tray-click", ()) {
                    log::warn!("Fehler beim Emittieren des tray-click Events: {}", e);
                }
            }
        })
        .build(app)?;

    log::info!("System-Tray erstellt mit ID: {}", TRAY_ID);
    Ok(())
}

/// Zeigt das Hauptfenster und setzt den Fokus.
fn show_and_focus_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.unminimize() {
            log::warn!("Fehler beim Wiederherstellen des Fensters: {}", e);
        }
        if let Err(e) = window.show() {
            log::warn!("Fehler beim Anzeigen des Fensters: {}", e);
        }
        if let Err(e) = window.set_focus() {
            log::warn!("Fehler beim Fokussieren des Fensters: {}", e);
        }
        log::info!("Hauptfenster geöffnet und fokussiert");
    } else {
        log::warn!("Hauptfenster 'main' nicht gefunden");
    }
}

// =============================================================================
// Tauri Commands für Badge-Update (Story 1.9 - Task 3)
// =============================================================================

/// Aktualisiert das Tray-Badge mit der Anzahl ausgelöster Erinnerungen.
///
/// AC1: Tray-Icon zeigt rotes Badge mit Anzahl bei AUSGELOEST Erinnerungen.
/// AC2: Neutrales Icon ohne Badge wenn count == 0.
///
/// MVP-Implementierung: Tooltip-Update statt Icon-Switching.
/// Später kann Icon-Switching mit echten Badge-Icons implementiert werden.
#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    log::info!("update_tray_badge aufgerufen mit count: {}", count);

    let tray_id = TrayIconId::new(TRAY_ID);
    let tray = app
        .tray_by_id(&tray_id)
        .ok_or_else(|| format!("Tray mit ID '{}' nicht gefunden", TRAY_ID))?;

    // Tooltip mit Badge-Count aktualisieren
    let tooltip = if count == 0 {
        DEFAULT_TOOLTIP.to_string()
    } else if count == 1 {
        format!("{} - 1 Erinnerung ausgelöst", DEFAULT_TOOLTIP)
    } else {
        format!("{} - {} Erinnerungen ausgelöst", DEFAULT_TOOLTIP, count)
    };

    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| format!("Fehler beim Setzen des Tooltips: {}", e))?;

    log::info!("Tray-Tooltip aktualisiert: {}", tooltip);
    Ok(())
}

/// Setzt das Tray-Badge zurück (kein Badge).
///
/// Convenience-Wrapper für update_tray_badge(0).
#[tauri::command]
pub fn clear_tray_badge(app: AppHandle) -> Result<(), String> {
    log::info!("clear_tray_badge aufgerufen");
    update_tray_badge(app, 0)
}
