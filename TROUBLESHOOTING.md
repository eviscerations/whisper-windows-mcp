# whisper-windows-mcp — Troubleshooting

---

## Quick checklist

Before diving deeper, verify all of the following:

- Paths in `claude_desktop_config.json` use **double backslashes** (`C:\\whisper\\...`)
- `whisper-cli.exe` exists at the path specified in `WHISPER_CLI_PATH`
- The model `.bin` file exists at the path specified in `WHISPER_MODEL`
- FFmpeg is installed and accessible (`ffmpeg -version` works in a command prompt)
- Claude Desktop was **fully restarted** after editing the config (quit from the system tray, not just the window)
- The whisper server shows **running** (green badge) in Settings → Developer

---

## "whisper is not connected" or no tools available

**Most common cause:** Claude Desktop was not fully restarted after editing the config.

1. Right-click the Claude icon in the system tray → Quit
2. Reopen Claude Desktop
3. Go to Settings → Developer and check for a green **running** badge next to whisper

If still not showing:

1. Open `claude_desktop_config.json` and check for JSON syntax errors (missing commas, mismatched braces)
2. Make sure all paths use double backslashes
3. Run `check_config` in Claude Desktop to get a diagnostic

---

## `check_config` reports whisper-cli.exe not found

The path in your config doesn't match where the file actually is.

Verify the file exists:
```
dir C:\whisper\Release\whisper-cli.exe
```

If it's somewhere else, update `WHISPER_CLI_PATH` in your config to match the actual path.

---

## `check_config` reports FFmpeg not found

FFmpeg is not installed or not in your system PATH.

Install via winget:
```
winget install ffmpeg
```

Or download from [ffmpeg.org](https://ffmpeg.org/download.html), extract, and add the `bin` folder to your system PATH.

After installing, open a new command prompt and verify:
```
ffmpeg -version
```

If you installed FFmpeg to a non-standard location, set the `FFMPEG_PATH` environment variable in your Claude Desktop config:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## Transcript output is full of `[FOREIGN]` tags

**Cause:** You are using an English-only model (e.g. `ggml-medium.en.bin`) on non-English audio. English-only models cannot process other languages and output `[FOREIGN]` as a placeholder for every segment they cannot handle.

**Fix:** Download and use `ggml-large-v3.bin` — the multilingual model. This is required for any non-English transcription, auto language detection, or translation.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Save to `C:\whisper\models\` and update your config:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

Or override per-transcription using the `model` parameter in `transcribe_audio` or `generate_subtitles`.

> **Note:** English-only models (`*.en.bin`) are faster and more accurate for English content but are completely unable to handle other languages. If you work with multilingual content, `large-v3` is the correct model regardless of hardware.

---

## Transcription produces no output or empty file

**Possible causes:**

1. **Wrong model for the language** — English-only models (`*.en.bin`) cannot transcribe other languages. Use `ggml-large-v3.bin` for multilingual content.

2. **Audio quality too low** — Very low bitrate files (e.g. old `.3gp` phone recordings using AMR-NB codec at ~12kbps) may be at the edge of what whisper can process. Noisy environments (background noise, reverb, distant speakers) are also challenging. Try `large-v3` which handles degraded audio better than smaller models.

3. **File is silent or corrupted** — Run `analyze_media` on the file to check if FFprobe detects a valid audio stream.

4. **Conversion failure** — The file may not be converting to WAV correctly. Try converting manually first:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Then transcribe the WAV directly.

---

## Background job fails on files with special characters or Unicode in the filename

**Cause:** whisper-cli.exe cannot write the output file when the path contains Unicode characters (Japanese, Chinese, emoji, brackets, etc.) or certain special characters.

**Current workaround:** Rename the file to use only ASCII characters before transcribing, then rename it back afterward if needed.

```
ren "▶ 日本語ファイル名.mp4" "temp_transcribe.mp4"
```

**Status:** This is a known bug. A fix is planned that will route output through a sanitized temp path and move the result to the correct destination after completion.

---

## Background job shows "failed" with no output

**Possible causes:**

1. **Unicode filename** — See above.

2. **Model path wrong** — The detached process doesn't inherit corrected paths. Run `check_config` to verify paths.

3. **Process was killed** — If whisper-cli.exe was manually terminated mid-job, no output file will exist. Retry.

4. **Insufficient VRAM** — Large models on low-VRAM GPUs may fail silently. Try a smaller model.

5. **File conversion failed** — Try transcribing a WAV file directly to isolate whether the issue is conversion or transcription.

---

## Background transcription doesn't produce SRT output

**Cause:** Background mode (`background=true` in `transcribe_audio`) currently only produces `.txt` output. SRT format in background mode is not yet implemented.

**Workaround:** For SRT files on files under ~4 minutes, use `generate_subtitles` in blocking mode. For longer files, transcribe in background mode first to get the `.txt`, then if SRT is needed, use `generate_subtitles` on the same file (it will re-transcribe).

**Status:** SRT support in background mode is planned for a future release.

---

## GPU not being used (CPU stuck at 50%+)

**Cause:** You're running the CPU-only binary that ships with the standard whisper.cpp release.

**Fix:** Download the Vulkan-enabled build from the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) and extract to `C:\whisper\Release\`.

Verify GPU acceleration is active:
- Ask Claude to `check_system`
- Look for `✅ Vulkan binary: ggml-vulkan.dll found` in the output
- Watch Task Manager → Performance → GPU during a transcription — GPU utilization should climb to 15–30%

---

## `check_system` reports wrong VRAM amount

This is a known Windows limitation. The `wmic` command reads VRAM from the registry, which on many AMD cards reports half the physical VRAM. A Vega 56 with 8GB HBM2 will typically show 4GB. This is a display issue only — whisper uses the full physical VRAM during inference.

---

## "Transcription already in progress" error

A `whisper-cli.exe` process is running from a previous job. Wait for it to finish, or:

1. Open Task Manager → Details tab
2. Find `whisper-cli.exe`
3. Right-click → End task

Then retry.

---

## Auto language detection wrong

Whisper's auto-detection runs on the first 30 seconds of audio. If the file starts in a different language than the majority of its content, detection may be wrong.

**Fix:** Specify the language explicitly (e.g. `language=ja`) rather than relying on auto-detection.

---

## Subtitle generation produces "(speaking in foreign language)" throughout

Whisper detected speech but couldn't transcribe it. Most common causes:

1. **Wrong model** — Using an English-only model on non-English audio. Use `large-v3`.

2. **Audio quality** — Noisy environments (kitchens, crowds, reverb) may defeat the medium model. Try `large-v3`.

3. **Mixed language** — Files with two languages switching back and forth will have the minority language placeholdered with a single language setting.

---

## Subtitle translation only outputs English

This is by design. Whisper's built-in `--translate` flag only translates **to English**. For translation to other target languages, translate the `.srt` file content separately.

---

## Batch transcription stopped advancing

Call `check_batch_progress` again. If still stuck:

1. Check Task Manager for a running `whisper-cli.exe` process
2. Check job logs in `%TEMP%\whisper-mcp-jobs\`
3. Failed files are flagged in the batch report — re-run them individually with `transcribe_audio`

---

## Large unattended batch from the command line

For very large batches where you want to run overnight without Claude:

```
for %f in (C:\path\to\folder\*.mp4) do (
  C:\whisper\Release\whisper-cli.exe -m C:\whisper\models\ggml-medium.en.bin -f "%f" --no-timestamps -otxt
)
```

This writes `.txt` files next to each source. The MCP tools will recognize these as already-transcribed when you run `analyze_media` or `start_batch` afterward.

---

## Config file location

```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

If `AppData` is not visible: View → Show → Hidden items in File Explorer.

---

## Full working config example

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

`FFMPEG_PATH` defaults to `ffmpeg` (assumes it's in PATH). Only set it explicitly if FFmpeg is installed somewhere non-standard.
