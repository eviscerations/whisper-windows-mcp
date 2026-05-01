# whisper-windows-mcp

A Windows-native MCP (Model Context Protocol) server that lets Claude Desktop transcribe audio files locally using [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — no internet connection required, no data sent to the cloud.

> **Why does this exist?**
> The popular `whisper-mcp` package was built for macOS and assumes a Unix environment. It does not work on Windows. This package was written specifically for Windows users who want the same local transcription functionality in Claude Desktop.

---

## What you can do with it

Once installed, you can say things like this directly in Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe this recording and summarise the key points"*
- *"Transcribe with timestamps so I can find specific moments"*

Everything runs on your own machine. No audio ever leaves your computer.

---

## Requirements

You need the following installed before proceeding. Each one is free.

| Requirement | Purpose |
|---|---|
| [Node.js 18+](https://nodejs.org/en/download) | Runs the MCP server |
| [whisper.cpp](https://github.com/ggerganov/whisper.cpp/releases/latest) | The transcription engine |
| A Whisper model file | The AI model (downloaded in Step 2) |

---

## Step 1 — Install whisper.cpp

1. Go to the [whisper.cpp latest release](https://github.com/ggerganov/whisper.cpp/releases/latest)
2. Download the file named **`whisper-bin-x64.zip`** (look for `win` and `x64` in the filename)
3. Extract the ZIP and move the contents to **`C:\whisper\Release\`** — create this folder if it doesn't exist

✅ You should now have **`C:\whisper\Release\whisper-cli.exe`**

> **Why this path?** You can install whisper.cpp anywhere, but `C:\whisper\Release\` matches the default config below and means less to edit later.

---

## Step 2 — Download a Whisper model

The model is the AI that does the actual transcription. Click a link below to download directly:

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

✅ To verify, open Command Prompt and run `node --version` — you should see something like `v20.x.x`

---

## Step 4 — Configure Claude Desktop

1. Open Claude Desktop → **Settings → Developer → Edit Config**
2. Add the following (or merge the `mcpServers` block if you already have other servers):

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

## Step 5 — Test it

In Claude Desktop, type:

> *"Can you check your whisper config?"*

Claude will verify that `whisper-cli.exe` and your model file are both found. Then try:

> *"Please transcribe C:\Users\YourName\Downloads\recording.mp3"*

---

## Converting video files to audio

Whisper processes audio. If you have a video file (MP4, MKV, etc.) you may want to extract the audio first — audio-only files are much smaller and faster to process.

> **Tip:** whisper.cpp may handle MP4 files directly if FFmpeg is installed. Try transcribing an MP4 first before converting.

**Using VLC Media Player** (free, recommended for beginners):

1. Download [VLC](https://www.videolan.org/vlc/) if you don't have it
2. Open VLC → **Media → Convert / Save**
3. Click **Add**, select your video, then click **Convert / Save**
4. Under **Profile**, choose **Audio - MP3**
5. Set a destination filename and click **Start**

A 1-hour MP4 that might be 2–4 GB typically becomes a 50–100 MB MP3.

**Using FFmpeg** (command line, for advanced users):
```
ffmpeg -i "C:\path\to\video.mp4" -vn -ac 1 -ar 16000 "C:\path\to\output.wav"
```

---

## Output formats

| Format | What you get | Ask Claude... |
|---|---|---|
| `text` (default) | Plain transcript, no timestamps | *"Transcribe this file"* |
| `timestamps` | Transcript with `[00:00:00 --> 00:00:05]` time codes | *"Transcribe with timestamps"* |
| `json` | Structured data | *"Transcribe as JSON"* |

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

> **GPU acceleration** for AMD (ROCm) and NVIDIA (CUDA) on Windows is planned for a future update.

---

## Full config example

If you have other MCP servers already configured:

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
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-base.en.bin"
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

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

Quick checklist:

- [ ] Config paths use **double backslashes** (`C:\\whisper\\...`)
- [ ] `whisper-cli.exe` exists at the path specified
- [ ] The model `.bin` file exists at the path specified
- [ ] Claude Desktop was **fully restarted** after editing the config
- [ ] Whisper shows **running** in Settings → Developer

---

## Roadmap

- [ ] SRT subtitle output
- [ ] Direct MP4/video file support via FFmpeg
- [ ] Translation to English from other languages
- [ ] AMD GPU acceleration (ROCm)
- [ ] NVIDIA GPU acceleration (CUDA)
- [ ] Speaker diarization (automatic speaker identification)

---

## License

MIT — free to use, modify, and distribute.

---

## Contributing

Pull requests welcome. GPU acceleration solutions for AMD or NVIDIA especially appreciated. Windows 11 feedback welcome via Issues.
