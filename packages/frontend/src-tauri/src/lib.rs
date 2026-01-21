mod sound;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System-Tray erstellen (Story 1.9)
            #[cfg(desktop)]
            {
                tray::create_tray(app.handle())
                    .map_err(|e| format!("System-Tray konnte nicht erstellt werden: {}", e))?;
            }

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|_app, args, cwd| {
            log::info!(
                "Single instance triggered with args: {:?} from cwd: {:?}",
                args,
                cwd
            );

            // Extract deep link URLs from args
            if !args.is_empty() {
                for arg in args.iter() {
                    if arg.starts_with("bluelight://") {
                        log::info!("Received deep link: {}", arg);
                        // Deep link event will be handled by the deep-link plugin
                    }
                }
            }
        }))
        // Commands registrieren: Sound (Story 1.5) + Tray (Story 1.9)
        .invoke_handler(tauri::generate_handler![
            sound::play_sound,
            sound::test_audio,
            tray::update_tray_badge,
            tray::clear_tray_badge
        ]);

    // Barcode scanner is only available on mobile (iOS/Android)
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
