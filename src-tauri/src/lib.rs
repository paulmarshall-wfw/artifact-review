#[tauri::command]
fn service_base_url() -> String {
    std::env::var("VITE_ARTIFACT_REVIEW_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:4793".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![service_base_url])
        .run(tauri::generate_context!())
        .expect("error while running Artifact Review");
}

