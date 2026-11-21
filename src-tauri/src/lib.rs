// FileForge desktop shell.
//
// All image processing happens in the web view (the same code as the website).
// This shell only adds the two things a web page cannot do on its own:
//   - a native "Save as" dialog  (tauri-plugin-dialog)
//   - writing the file the person chose  (tauri-plugin-fs)
// It defines no custom commands and makes no network requests.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("FileForge could not start");
}
