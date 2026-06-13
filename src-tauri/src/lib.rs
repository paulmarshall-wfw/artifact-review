use std::process::Command;

#[tauri::command]
fn service_base_url() -> String {
    std::env::var("VITE_ARTIFACT_REVIEW_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:4794".to_string())
}

#[tauri::command]
fn select_export_destination(default_file_name: String) -> Result<Option<String>, String> {
    platform_select_export_destination(&default_file_name)
}

#[tauri::command]
fn reveal_exported_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn platform_select_export_destination(default_file_name: &str) -> Result<Option<String>, String> {
    let output = Command::new("osascript")
        .args([
            "-e",
            "on run argv",
            "-e",
            "set defaultName to item 1 of argv",
            "-e",
            "set chosenFile to choose file name default name defaultName",
            "-e",
            "POSIX path of chosenFile",
            "-e",
            "end run",
            "--",
            default_file_name,
        ])
        .output()
        .map_err(|error| format!("Unable to open export destination picker: {error}"))?;

    if output.status.success() {
        let selected_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok((!selected_path.is_empty()).then_some(selected_path));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("User canceled") || stderr.contains("-128") {
        return Ok(None);
    }

    Err(stderr.trim().to_string())
}

#[cfg(target_os = "windows")]
fn platform_select_export_destination(default_file_name: &str) -> Result<Option<String>, String> {
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.FileName = $args[0]
$dialog.Filter = 'Review exports|*.txt;*.md;*.html;*.htm|All files|*.*'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Write($dialog.FileName)
}
"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", script, default_file_name])
        .output()
        .map_err(|error| format!("Unable to open export destination picker: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let selected_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok((!selected_path.is_empty()).then_some(selected_path))
}

#[cfg(target_os = "linux")]
fn platform_select_export_destination(default_file_name: &str) -> Result<Option<String>, String> {
    let output = Command::new("zenity")
        .args(["--file-selection", "--save", "--confirm-overwrite", "--filename", default_file_name])
        .output()
        .map_err(|error| format!("Unable to open export destination picker: {error}"))?;

    if output.status.success() {
        let selected_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok((!selected_path.is_empty()).then_some(selected_path));
    }

    Ok(None)
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn platform_select_export_destination(_default_file_name: &str) -> Result<Option<String>, String> {
    Err("Export destination picker is not available on this platform.".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            service_base_url,
            select_export_destination,
            reveal_exported_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Artifact Review");
}
