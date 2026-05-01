# Troubleshooting

This document covers common issues and their solutions, including workarounds for known limitations.

---

## "whisper-cli not found" error

**Symptom:** Claude reports `whisper-cli not found` or suggests running `brew install whisper-cpp`.

The `brew install` suggestion is a macOS instruction and does not apply to Windows. This error means the MCP server cannot locate `whisper-cli.exe`.

**Fix:** Make sure `WHISPER_CLI_PATH` in your `claude_desktop_config.json` points to the exact location of `whisper-cli.exe`, using double backslashes:

```json
"WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe"
```

Verify the file exists by navigating to it in File Explorer.

---

## "File not found" when transcribing

1. **Wrong path format** — when typing paths directly in Claude chat, use normal single backslashes: `C:\Users\Me\Downloads\audio.mp3`
2. **File doesn't exist** — double-check in File Explorer
3. **Spaces in path** — paths with spaces work fine, just make sure you give Claude the complete path

---

## Video files fail with FFmpeg error

**Symptom:** Transcribing an MP4 or other video file fails with an FFmpeg-related error.

**Fix:** Make sure FFmpeg is installed and in your system PATH.

1. Download FFmpeg from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract and note the location of `ffmpeg.exe` (usually in a `bin` subfolder)
3. Add that folder to your system PATH:
   - **Win + S** → search **Environment Variables** → open it
   - Under **User Variables**, select **Path** → **Edit** → **New**
   - Add the path to the folder containing `ffmpeg.exe`
   - Click OK on all dialogs, then restart Claude Desktop

✅ Verify FFmpeg is working: open Command Prompt and run `ffmpeg -version`

Alternatively, add `FFMPEG_PATH` to your config pointing directly to `ffmpeg.exe`:
```json
"FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
```

---

## Whisper server shows as "error" in Settings → Developer

1. Make sure your `claude_desktop_config.json` is valid JSON — a missing comma or bracket breaks it. Paste it into [jsonlint.com](https://jsonlint.com) to check.
2. Make sure Node.js is installed: open Command Prompt and run `node --version`
3. Fully quit Claude Desktop (check Task Manager for any remaining Claude processes) and reopen it

---

## Transcription runs but produces garbled text

- **Wrong language:** Specify the language when asking Claude — *"Transcribe this in English"* or add `"language": "en"` in the call
- **Poor audio quality:** Whisper handles most accents well but very low bitrate or heavily distorted audio will reduce accuracy
- **Try a larger model:** `medium.en` is significantly more accurate than `base.en`, at the cost of speed

---

## Transcription is very slow

This is expected on CPU. Rough estimates for a 1-hour file:

| Model | Time |
|---|---|
| base.en | 10–20 min |
| medium.en | 35–60 min |

To speed up, increase the thread count by adding to your config:
```json
"WHISPER_THREADS": "12"
```

Use up to the number of logical cores your CPU has (check Task Manager → Performance → CPU for your core count).

---

## Cancelling a long transcription

**Known limitation:** Clicking the stop/cancel button in Claude Desktop while a transcription is running will return control to Claude but does NOT stop the underlying whisper-cli process. It continues running in the background consuming CPU.

**To actually stop it:**
1. Open Task Manager (Ctrl + Shift + Esc)
2. Go to the **Details** tab
3. Find `whisper-cli.exe` and right-click → **End Process Tree**

---

## Running large overnight batch jobs (unattended)

**Known limitation:** Claude Desktop has a connection timeout that prevents long-running batch operations through the MCP server. For large unattended batch jobs (many files, or long recordings), use whisper-cli directly from the command line instead.

**Single file from command line:**
```
"C:\whisper\Release\whisper-cli.exe" -m "C:\whisper\models\ggml-medium.en.bin" -f "C:\path\to\audio.mp3" --no-timestamps -t 8 > "C:\path\to\output.txt"
```

**Batch folder using PowerShell (run from PowerShell window):**
```powershell
$folder = "C:\path\to\your\folder"
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model = "C:\whisper\models\ggml-medium.en.bin"

Get-ChildItem $folder -Include *.mp4,*.mp3,*.mkv,*.wav -Recurse | ForEach-Object {
    $out = $_.FullName -replace '\.[^.]+$', '.txt'
    Write-Host "Processing: $($_.Name)"
    & $whisper -m $model -f $_.FullName --no-timestamps -t 8 | Out-File -FilePath $out -Encoding utf8
    Write-Host "Done: $out"
}
Write-Host "Batch complete."
```

Save this as a `.ps1` file and run it from PowerShell, or paste it directly into a PowerShell window. You can let it run overnight — it will process each file sequentially and save a `.txt` next to each source file.

> **Note:** If PowerShell blocks the script with an execution policy error, run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## Claude Desktop fails to install or update (HRESULT errors)

This is a Windows MSIX packaging issue, not related to this MCP server. Steps to resolve:

1. Fully uninstall Claude Desktop via **Settings → Apps → Apps & features**
2. Open Task Manager and end any remaining Claude or Cowork processes
3. Delete `C:\Users\YourUsername\AppData\Local\AnthropicClaude` if it exists
4. **Restart your computer** — some package registrations persist in memory until reboot
5. Run the installer again after reboot

---

## Double backslashes in JSON — why?

In JSON, the backslash `\` is an escape character. To represent a literal backslash (as used in Windows paths), you must write `\\`. So:

| Windows path | In JSON config |
|---|---|
| `C:\whisper\Release\whisper-cli.exe` | `"C:\\whisper\\Release\\whisper-cli.exe"` |

This only applies inside the JSON config file. When typing paths into Claude in the chat, use normal single backslashes.

---

## Config file location

```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

The `AppData` folder is hidden by default. To show hidden folders: File Explorer → **View → Show → Hidden items**.

You can also reach the config via Claude Desktop → **Settings → Developer → Edit Config**.

---

## Still stuck?

Open an issue at [github.com/eviscerations/whisper-windows-mcp/issues](https://github.com/eviscerations/whisper-windows-mcp/issues) and include:

- Your Windows version
- Your `claude_desktop_config.json` (remove personal info)
- The MCP server log from **Settings → Developer → View Logs**
- What you've already tried
