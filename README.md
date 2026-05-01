# whisper-windows-mcp

A Windows-native MCP (Model Context Protocol) server that lets Claude Desktop transcribe audio and video files locally using [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — no internet connection required, no data sent to the cloud.

> **Why does this exist?**
> The popular `whisper-mcp` package was built for macOS and assumes a Unix environment. It does not work on Windows. This package was written specifically for Windows users who want the same local transcription functionality in Claude Desktop.

---

## What you can do with it

Once installed, you can say things like this directly in Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe C:\Users\Me\Videos\interview.mp4"* — video files work directly, no conversion needed
- *"Transcribe this recording and summarise the key points"*
- *"Transcribe with timestamps so I can find specific moments"*
- *"Generate subtitles for C:\Users\Me\Videos\lecture.mp4"*
- *"Transcribe all files in C:\Users\Me\Videos\clips\ one at a time"*

Everything runs on your own machine. No audio ever leaves your computer.

---

## Requirements

| Requirement | Purpose | Download |
|---|---|---|
| Node.js 18+ | Runs the MCP server | [nodejs.org](https://nodejs.org/en/download) |
| whisper.cpp | The transcription engine | [Latest release](https://github.com/ggerganov/whisper.cpp/releases/latest) |
| A Whisper model file | The AI model | See Step 2 below |
| FFmpeg | Video file support | [ffmpeg.org](https://ffmpeg.org/download.html) |

> FFmpeg is optional if you only use MP3/WAV files, but required for MP4, MKV, AVI, MOV and other video formats.

---

## Step 1 — Install whisper.cpp

1. Go to the [whisper.cpp latest release](https://github.com/ggerganov/whisper.cpp/releases/latest)
2. Download the file named **`whisper-bin-x64.zip`** (look for `win` and `x64` in the filename)
3. Extract the ZIP and move the contents to **`C:\whisper\Release\`** — create this folder if it doesn't exist

✅ You should now have **`C:\whisper\Release\whisper-cli.exe`**

> **Why this path?** You can install whisper.cpp anywhere, but `C:\whisper\Release\` matches the default config below and means less to edit later.

---

## Step 2 — Download a Whisper model

Click a link below to download directly:

| Model | Download | Size | Speed | Best for |
|---|---|---|---|---|
| tiny.en | [Download](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin) | 75 MB | Very fast | Quick tests |
| **base.en** | [**Download**](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin) | 142 MB | Fast | **Recommended starting point** |
| small.en | [Download](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin) | 466 MB | Moderate | Better accuracy |
| medium.en | [Download](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin) | 1.5 GB | Slow | High accuracy |
| large-v3 | [Download](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin) | 2.9 GB | Very slow | Maximum accuracy |

Save the downloaded `.bin` file to **`C:\whisper\models\`** — create this folder if it doesn't exist.

✅ You should now have something like **`C:\whisper\models\ggml-base.en.bin`**

---

## Step 3 — Install Node.js

If you don't already have Node.js:

1. Go to [nodejs.org](https://nodejs.org/en/download) and download the **Windows Installer (.msi)** — choose the LTS version
2. Run the installer and accept all defaults

✅ Verify: open Command Prompt and run `node --version` — you should see something like `v20.x.x`

---

## Step 4 — Install FFmpeg (recommended)

FFmpeg is required for video files (MP4, MKV, AVI, MOV, etc.).

1. Go to [ffmpeg.org/download.html](https://ffmpeg.org/download.html) and download a Windows build
2. Extract and move the `bin` folder contents (or the whole folder) somewhere permanent, e.g. `C:\ffmpeg\bin\`
3. Add `C:\ffmpeg\bin` to your system PATH:
   - Press **Win + S** → search **Environment Variables** → open it
   - Under **User Variables**, select **Path** → **Edit** → **New**
   - Add `C:\ffmpeg\bin` → click OK on all dialogs

✅ Verify: open a new Command Prompt and run `ffmpeg -version`

---

## Step 5 — Configure Claude Desktop

1. Open Claude Desktop → **Settings → Developer → Edit Config**
2. Add the following (or merge the `mcpServers` block if you have other servers):

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-base.en.bin"
      }
    }
  }
}
```

> ⚠️ **Path format:** In the JSON config, all backslashes must be doubled (`\\`). This is a JSON requirement. When typing paths into Claude in chat, use normal single backslashes.

3. If you downloaded a different model, update `ggml-base.en.bin` to match your filename
4. Save the file, fully quit Claude Desktop, and reopen it
5. Go to **Settings → Developer** — you should see **whisper** with a green **running** badge

---

## Step 6 — Test it

In Claude Desktop, type:

> *"Can you check your whisper config?"*

Claude will verify that everything is found correctly. Then try:

> *"Please transcribe C:\Users\YourName\Downloads\recording.mp3"*

---

## Available tools

| Tool | What it does |
|---|---|
| `transcribe_audio` | Transcribe a single file — audio or video |
| `transcribe_batch` | Transcribe all files in a folder, one at a time with preview |
| `generate_subtitles` | Generate an `.srt` subtitle file next to the source |
| `check_config` | Verify all paths and FFmpeg are working |

---

## Output formats

| Format | What you get | Ask Claude... |
|---|---|---|
| `text` (default) | Plain transcript, no timestamps | *"Transcribe this file"* |
| `timestamps` | Transcript with `[00:00:00 --> 00:00:05]` time codes | *"Transcribe with timestamps"* |
| `json` | Structured data | *"Transcribe as JSON"* |
| `srt` | Subtitle file saved next to source | *"Generate subtitles for..."* |

---

## Supported file formats

**Audio (native):** MP3, WAV

**Audio (via FFmpeg):** M4A, FLAC, OGG

**Video (via FFmpeg):** MP4, MKV, AVI, MOV, WebM, FLV, WMV, M4V

> H.264 and H.265/HEVC video both work. FFmpeg must be installed and in your PATH for any video or non-MP3 audio format.

---

## Batch transcription

To transcribe multiple files in a folder interactively:

> *"Transcribe all files in C:\Users\Me\Videos\clips\"*

Claude will list all detected files (with checkmarks on already-completed ones), then process them one at a time, showing you a preview of each transcript before moving to the next.

**For large unattended overnight batches**, use whisper-cli directly from the command line — see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for the syntax. This is more reliable than running through Claude for very large jobs.

---

## Transcription speed

Whisper runs on CPU by default. Rough estimates for a 1-hour recording:

| Model | Approximate time (CPU) |
|---|---|
| tiny.en | 5–10 minutes |
| base.en | 10–20 minutes |
| small.en | 20–35 minutes |
| medium.en | 35–60 minutes |
| large-v3 | 60–120 minutes |

You can increase thread count by adding `"WHISPER_THREADS": "12"` to the `env` block in your config (replace `12` with however many threads you want — up to your CPU's logical core count).

> **GPU acceleration** for AMD (ROCm) and NVIDIA (CUDA) on Windows is planned for a future update.

---

## Converting video to audio (optional)

whisper-windows-mcp handles video files automatically via FFmpeg, so manual conversion is no longer required. However, if you want a smaller audio-only file for any reason, VLC makes it easy:

1. Open VLC → **Media → Convert / Save**
2. Click **Add**, select your video, then **Convert / Save**
3. Under **Profile**, choose **Audio - MP3**
4. Set a destination filename and click **Start**

---

## Full config example

```json
{
  "preferences": {
    "coworkWebSearchEnabled": true
  },
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-base.en.bin",
        "WHISPER_THREADS": "8",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

Config file location:
```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

> The `AppData` folder is hidden by default. To show it: File Explorer → **View → Show → Hidden items**

---

## Tested on

- Windows 10 Pro (10.0.19045)
- Windows 11 — untested, feedback welcome via [Issues](../../issues)

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions including how to run large overnight batch jobs from the command line.

Quick checklist:

- [ ] Config paths use **double backslashes** (`C:\\whisper\\...`)
- [ ] `whisper-cli.exe` exists at the path specified
- [ ] The model `.bin` file exists at the path specified
- [ ] Claude Desktop was **fully restarted** after editing the config
- [ ] Whisper shows **running** in Settings → Developer
- [ ] FFmpeg is in PATH if using video files

---

## Roadmap

- [ ] AMD GPU acceleration (ROCm)
- [ ] NVIDIA GPU acceleration (CUDA)
- [ ] Speaker diarization (automatic A/B speaker identification)
- [ ] Translation to English from other languages
- [ ] Unattended background batch processing

---

## Support this project

If this tool saved you time and you'd like to support continued development:

- ⭐ **Star this repo** — it helps others find it
- 💬 **Open an issue** if you find a bug or have a feature request
- 💖 **Sponsor** — [GitHub Sponsors](https://github.com/sponsors/eviscerations) | [Ko-fi](https://ko-fi.com) | [Patreon](https://patreon.com)

---

## License

MIT — free to use, modify, and distribute.

---

## Contributing

Pull requests welcome. GPU acceleration for AMD or NVIDIA especially appreciated. Windows 11 feedback welcome via Issues.
