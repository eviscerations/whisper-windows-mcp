# Troubleshooting — whisper-windows-mcp

---

## Quick checklist

Before diving into specific issues, verify the basics:

- Paths in `claude_desktop_config.json` use **double backslashes** (`C:\\whisper\\Release\\whisper-cli.exe`)
- `whisper-cli.exe` exists at the path configured in `WHISPER_CLI_PATH`
- The model `.bin` file exists at the path configured in `WHISPER_MODEL`
- FFmpeg is installed and in PATH — run `ffmpeg -version` in a terminal to confirm
- Claude Desktop was **fully restarted** after editing the config (quit from the system tray, not just closing the window)
- Whisper shows a **green running badge** in Claude Desktop → Settings → Developer

---

## Installation and startup

### Whisper doesn't appear in Claude Desktop → Settings → Developer

1. Open Claude Desktop → Settings → Developer → Edit Config
2. Confirm the JSON is valid — paste it into [jsonlint.com](https://jsonlint.com) if unsure
3. Confirm `WHISPER_CLI_PATH` and `WHISPER_MODEL` point to files that actually exist
4. Quit Claude Desktop from the system tray (right-click the tray icon → Quit)
5. Relaunch Claude Desktop and check again

If whisper appears but shows an error badge instead of green:
- Ask Claude: *"Check your whisper config"* — the `check_config` tool returns a specific error message
- Check Claude Desktop → Settings → Developer → click the server name for the error log

### "whisper-cli.exe not found" error

The path in `WHISPER_CLI_PATH` does not match where the binary was extracted.

Default expected path: `C:\whisper\Release\whisper-cli.exe`

Confirm the file exists:
```powershell
Test-Path "C:\whisper\Release\whisper-cli.exe"
```

Should return `True`. If it returns `False`, either extract the release zip to `C:\whisper\Release\` or update `WHISPER_CLI_PATH` in your config to match where it actually is.

### "Model not found" error

The path in `WHISPER_MODEL` does not match the actual model file location or name.

Check the models directory:
```powershell
Get-ChildItem "C:\whisper\models\"
```

The filename must include the full name including quantization suffix, e.g. `ggml-large-v3-turbo-q5_0.bin` not `ggml-large-v3-turbo.bin`. If no models are installed, use `download_model` in Claude Desktop.

---

## GPU acceleration

### Transcription is slow — CPU-only, no GPU

Ask Claude: *"Check my system hardware"*

The `check_system` tool confirms whether `ggml-vulkan.dll` is present in the whisper binary directory. If the DLL is missing, you are running CPU-only regardless of your GPU.

**Fix:** Download `whisper-vulkan-win-x64.zip` from the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) and extract it to `C:\whisper\Release\`. The zip includes the DLL — it must be in the same directory as `whisper-cli.exe`.

### GPU detected but utilization is 0% during transcription

The binary is running but not dispatching to the GPU. This usually means:
- The Vulkan SDK is not installed or the GPU driver doesn't expose a Vulkan interface
- The GPU predates Vulkan 1.0 (rare — most GPUs since 2016 support it)

Check Vulkan support:
```powershell
# Install vulkaninfo if needed via Vulkan SDK, then:
vulkaninfo
```

Any output confirms Vulkan is available. If `vulkaninfo` fails, install the latest GPU driver from your GPU vendor's site.

### Transcription runs on the wrong GPU (multi-GPU systems)

By default whisper-cli uses Vulkan device 0. On a multi-GPU machine that may not be the card you want. Pin a specific device with the `WHISPER_GPU_DEVICE` env var (or the per-call `gpu_device` parameter, which now also works on `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **The index is the Vulkan enumeration order, NOT the Windows "GPU 0 / GPU 1" order** — they often differ. To find the right number, run `whisper-cli.exe` on any file once and read its startup log: it prints `ggml_vulkan: 0 = <name>`, `ggml_vulkan: 1 = <name>`. Use the index that lists your target card. `check_config` echoes the active device so you can confirm the pin took.

### VRAM reported as half the actual size (AMD)

This is a known Windows reporting quirk for AMD GPUs with unified/shared memory. The actual available VRAM for processing is typically double what `wmic` reports. The model recommendation may be overly conservative as a result — you can try a larger model than recommended and observe whether transcription completes successfully.

---

## Transcription quality

### Output contains hallucinated text or repeating phrases

Whisper occasionally hallucinates on silent or low-quality audio segments. The tool applies `--max-context 0` and `--no-speech-thold 0.6` by default to minimize this.

Additional approaches:
- Use `temperature=0.2` — slight randomness helps break hallucination loops on noisy audio
- Use a VAD (Voice Activity Detection) model: download a Silero VAD model `.bin` file and pass its path as `vad_model`. This strips silence before transcription, which is the most effective fix for hallucination on recordings with gaps.
- Use a larger model (`large-v3` or `large-v3-turbo`) — smaller models hallucinate more on difficult audio
- Use `prompt` to set context: *"This is a podcast interview about software engineering."*

### Transcription output is empty or very short

Ask Claude: *"Analyze this file"* (`analyze_media`) to confirm the file has audio content and is a recognized format.

If FFprobe reports audio but transcription produces nothing:
- The file may be in a language that doesn't match the configured `language` parameter
- Try `language=auto` to let Whisper detect the language
- The audio may be too quiet or heavily processed — transcription requires intelligible speech

### Timestamps mode output differs from SRT

In `timestamps` mode, output is printed to whisper's stdout as plain `[HH:MM:SS.mmm --> HH:MM:SS.mmm]  text` lines. In `srt` mode, whisper formats the output in numbered SRT blocks. The segment boundaries may differ slightly because the two paths use different output flags. Both are valid — use `srt` or `vtt` when you need the subtitle file format, and `timestamps` when you want the raw timestamped text.

---

## Privacy mode and consent gate

### I don't see a consent prompt before transcription

The consent gate fires **once per session** in standard mode. If you have already confirmed transcription in this session (since the last Claude Desktop restart), it won't fire again.

Other reasons the gate may not appear:
- `WHISPER_CONSENT_ACKNOWLEDGED=true` is set in your config — this suppresses the gate entirely
- `WHISPER_PRIVACY_MODE=true` is set — privacy mode uses its own separate per-operation gate, not the consent gate
- You are checking progress on a blocking transcription that already completed — the gate was consumed at the start of the job

**To reset and see the gate again:** fully restart Claude Desktop (quit from system tray, relaunch).

### Claude is processing my file without asking first

If `WHISPER_CONSENT_ACKNOWLEDGED=true` is in your config, the gate is suppressed by design. This is the intended behavior for users who have reviewed the privacy implications and no longer need the reminder.

If it is not set and Claude proceeded without asking, the session gate was already consumed by an earlier transcription in the same session. The gate fires once per session.

For per-operation confirmation on every transcription regardless of session state, enable privacy mode: pass `privacy_mode=true` or set `WHISPER_PRIVACY_MODE=true` in your config.

### Privacy mode is active but I want to read one transcript

Pass `privacy_mode=false` directly to the transcription tool for that specific call. This overrides the global `WHISPER_PRIVACY_MODE=true` setting for that one call only:

- *"Transcribe this file, privacy_mode=false"*

No restart required. The override only applies to that single tool call.

### Privacy mode is asking me to confirm before every file

This is the correct and intentional behavior. Privacy mode requires per-operation consent — the gate fires before every transcription and cannot be bypassed while privacy mode is active.

If you need to transcribe many files without per-file confirmation and the content is not sensitive, disable privacy mode:
- Remove `WHISPER_PRIVACY_MODE=true` from your config and restart Claude Desktop
- Or pass `privacy_mode=false` per-call for specific non-sensitive files

### Why does privacy mode ask every time, but the consent gate only asks once?

The two gates serve different users with different requirements.

The **consent gate** (standard mode) is a one-time informational disclosure. Once you understand that transcript text is transmitted to Claude's API, you don't need to be told again this session.

The **privacy mode gate** fires every time because the people who need it — healthcare providers, attorneys, financial professionals — require affirmative per-operation confirmation as part of their compliance workflow. Suppressing it would defeat the purpose.

### Background jobs and the consent gate

For background transcription (`background=true`) in standard mode, the consent gate fires at `check_progress` when the transcript is returned — **not** at `transcribe_audio` when the job starts. At job start time, no transcript exists yet. Gating before the job starts would block audio processing unnecessarily. The gate fires the moment transcript text would first be returned to the API.

For privacy mode background jobs, the gate fires **before spawning** — before any audio processing begins.

### How do I skip the consent gate permanently?

Set `WHISPER_CONSENT_ACKNOWLEDGED=true` in your `claude_desktop_config.json` env section. This suppresses the one-time session disclosure in standard mode.

Note: this has no effect when privacy mode is active.

---

## Background transcription and batch

### "This file is ~X long — run it in the background" / foreground transcription times out

Claude Desktop enforces a ~4-minute timeout on any single MCP tool call. A long file transcribed in **foreground** (blocking) mode can exceed it — the transcript still finishes and is written to disk, but the tool call itself errors out. To prevent that silent failure, `transcribe_audio` and `generate_subtitles` estimate the run time up front and, if it would likely cross the ceiling, return a message telling you to re-run with `background=true`. Background mode returns a job ID immediately and has no such limit — monitor it with `check_progress`.

Much of a transcription's wall-clock is **model loading**, not transcription: whisper-cli reloads the model on every invocation, and a large model (e.g. `large-v3`, 2.9 GB) on a memory-constrained GPU can take ~2 minutes to load before transcription even begins (a smaller or quantized model loads faster). The guard's threshold is configurable with `WHISPER_FOREGROUND_MAX_SEC` (seconds; default 210).

### Background job never shows as complete

The job state is tracked by the whisper-cli.exe process exit. Check:

1. Ask Claude: *"Check progress on job_id"* — if the process is still running, the tool returns "In progress" with elapsed time and last segment timestamp
2. If the file is very long (2+ hours), allow more time — GPU transcription of a 2-hour file takes roughly 15–20 minutes on a mid-range GPU
3. If elapsed time seems wrong, open Task Manager → Details and check if `whisper-cli.exe` is in the list

If `whisper-cli.exe` is not running but `check_progress` still shows "In progress":
- The process exited with an error and left no output file
- Ask Claude: *"Check progress on job_id"* — the tool will detect no PID and no output file and report the error with the last log lines

### Background job completed but output file is missing or in the wrong location

Background jobs write output to a temp path in `%TEMP%\whisper-mcp-jobs\` during processing, then move the file to the source directory on completion. If the move fails (disk full, permissions issue, or path length), `check_progress` returns a specific error:

> "Output file write failed. Transcription completed but could not be written to: [path]"

Check:
- The source directory exists and is writable
- There is enough disk space
- The target path is not too long (Windows has a 260-character path limit by default)

The raw output may still be in `%TEMP%\whisper-mcp-jobs\` with a job-ID-based filename.

### Batch is stuck or not advancing to the next file

`start_batch` uses an exit callback to self-advance without polling. If the batch appears stuck:

1. Call `check_batch_progress` — this forces a progress check and re-evaluates the current state
2. If the current file is still running, allow it to finish — check Task Manager for `whisper-cli.exe`
3. If `check_batch_progress` shows the current file as failed, it will attempt to advance to the next file

Note: in v2.3.0 and later, the batch self-advances via an exit callback when each file completes. You should not need to poll repeatedly — calling `check_batch_progress` once after some time has passed is enough to get a status update.

### Batch reports a file as "failed" even though it looks complete

The validator checks that the output file is non-empty and has at least one line per 30 seconds of audio. Short files or recordings with long silent sections may produce output that the validator considers suspiciously short.

If the transcript looks correct when you open it:
- The validation is overly conservative for this file
- Re-run it with `transcribe_audio` individually and check the result manually

If the output is genuinely wrong:
- Try `language=auto` if the language may not match the configured setting
- Try a larger model for better accuracy

### Multiple files fail immediately at the start of a batch

This usually means whisper-cli.exe is not working at all. Run `check_config` to verify all paths, then try a single file with `transcribe_audio` to see the specific error.

---

## Subtitle generation

### SRT file is saved but has the wrong name or is in the wrong location

SRT and VTT files are saved next to the source file with the language code appended when the source language is not English:
- English source: `filename.srt`
- Japanese source: `filename.ja.srt`
- With English translation: `filename.ja.srt` + `filename.en.srt`

If the file appears next to the temp WAV instead of the original source, check whether the source file needed format conversion (any format other than mp3/wav goes through FFmpeg). The output destination logic uses the original `file_path`, not the temp file path.

### VTT output is for web use — how do I load it in a desktop player?

VLC supports VTT via Subtitle → Add Subtitle File → select the `.vtt` file. Most other desktop players support SRT better than VTT. Use `output_format=srt` for maximum desktop player compatibility.

VTT is best for HTML5 `<video>` elements and web-based video players.

### LRC files are not displaying in my media player

LRC (`.lrc`) files are for players with lyric/karaoke display features: foobar2000, Winamp, AIMP, and various mobile players. Standard video players do not display LRC. If you need synchronized subtitles for video, use `srt` or `vtt` instead.

### CSV output — what is the format?

The CSV output includes segment start time, end time, and text per row. It's designed for import into spreadsheet tools or downstream analysis scripts. The exact column format matches whisper.cpp's `-ocsv` output. Use `srt` or `vtt` for actual subtitle display.

### Subtitle generation times out with a 4-minute error

`generate_subtitles` runs synchronously by default and can hit Claude Desktop's 4-minute MCP timeout on long files. Use `background=true` for files over 10 minutes:

- *"Generate subtitles for this file, background=true"*

Then check progress with `check_progress`. Note: `translate_to_english=true` is not available in background mode. Run a second pass after the background job completes to generate the translation.

---

## Model management

### `download_model` fails with a network error

The tool downloads from Hugging Face. Confirm your machine has internet access and that `huggingface.co` is not blocked by a firewall or proxy.

If the download starts but fails partway through, the `.part` file is deleted automatically. Re-run `download_model` to retry.

### `switch_model` says the model is not in the models directory

The `switch_model` tool only accepts files within the directory configured in `WHISPER_MODEL` (specifically, the directory containing that file).

If your model is in a different location, either move it to the models directory or update `WHISPER_MODEL` in your config to point to a file in the same directory as your models.

### Active model reverts to the config model after Claude Desktop restart

`switch_model` is session-scoped by design. To make a model switch permanent, update `WHISPER_MODEL` in `claude_desktop_config.json` and restart Claude Desktop.

---

## File paths and formats

### Unicode filenames cause transcription to fail silently

Background transcription routes all output through a sanitized ASCII job-ID-based temp path, which handles Unicode filenames correctly. If you see a failure with a Unicode filename in blocking mode, check that the file itself is accessible:

```powershell
Test-Path "C:\Users\YourName\Documents\会議録音.mp4"
```

Should return `True`. If the path is inaccessible to PowerShell, it will also be inaccessible to the MCP server.

### Video file produces no output or immediate error

FFmpeg is required for all video formats. Confirm FFmpeg is installed:
```
ffmpeg -version
```

If FFmpeg is not in PATH, set `FFMPEG_PATH` in your config to the full path to `ffmpeg.exe`.

If FFmpeg is installed but the specific video fails, it may be a corrupted file or an unusual codec variant. Try converting manually:
```
ffmpeg -i input.mp4 -ar 16000 -ac 1 output.wav
```
Then transcribe the WAV file directly.

### "File too large" error

The tool rejects files over 10 GB. This is a safety limit to prevent runaway memory usage. Files approaching this size should be split before transcription.

### UNC path rejection

Paths starting with `\\server\share` (UNC paths to network shares) are rejected by the input validator. Mount the network share as a drive letter (e.g. `Z:\`) and use that path instead.

---

## Temp file cleanup

Job state files (`.json` and `.log`) in `%TEMP%\whisper-mcp-jobs\` are automatically cleaned up at startup for files older than 7 days. Manual cleanup is still possible if needed:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Force
```

Temp WAV conversion files (`whisper_tmp_*.wav` in `%TEMP%`) are deleted immediately after each transcription completes. If a transcription crashes mid-run, these may be left behind. Delete them manually:

```powershell
Remove-Item "$env:TEMP\whisper_tmp_*.wav" -Force
```
