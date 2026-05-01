# whisper-windows-mcp

A Windows-native MCP (Model Context Protocol) server that lets Claude Desktop transcribe audio files locally using [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — no internet connection required, no data sent to the cloud.

> **Why does this exist?**
> The popular `whisper-mcp` package was built for macOS and assumes a Unix environment. It does not work on Windows. This package was written specifically for Windows users who want the same functionality.

---

## What you can do with it

Once installed, you can say things like this directly in Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe this recording and give me a summary"*
- *"Transcribe with timestamps so I can find specific moments"*

Everything runs on your own machine. No audio ever leaves your computer.

---

## Requirements

Before installing this package, you need three things set up on your Windows machine:

1. **Node.js 18 or later** — [download from nodejs.org](https://nodejs.org)
2. **whisper.cpp** — the actual transcription engine
3. **A Whisper model file** — the AI model that does the transcription

The sections below walk you through each one.

---

## Step 1 — Install whisper.cpp

1. Go to the [whisper.cpp releases page](https://github.com/ggerganov/whisper.cpp/releases)
2. Download the latest Windows ZIP (look for a file ending in `-win-x64.zip` or similar)
3. Extract it to a simple path with no spaces — recommended: `C:\whisper\Release\`

You should now have `C:\whisper\Release\whisper-cli.exe` on your system.

---

## Step 2 — Download a Whisper model

Models are downloaded from Hugging Face. Choose one based on your needs:

| Model | File size | Speed | Accuracy | Recommended for |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Very fast | Basic | Quick tests |
| `ggml-base.en.bin` | 142 MB | Fast | Good | Everyday use |
| `ggml-small.en.bin` | 466 MB | Moderate | Better | Important recordings |
| `ggml-medium.en.bin` | 1.5 GB | Slow | Very good | Best quality on CPU |
| `ggml-large-v3.bin` | 2.9 GB | Very slow | Excellent | Maximum accuracy |

**For most people, `base.en` or `small.en` is the best starting point.**

Download your chosen model from:
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```
(Replace `ggml-base.en.bin` with whichever model you want.)

Save it to `C:\whisper\models\` — create that folder if it doesn't exist.

---

## Step 3 — Install this MCP server

Open Command Prompt and run:

```
npm install -g whisper-windows-mcp
```

Or if you prefer to run it without installing globally, you can use `npx` directly in your config (see Step 4).

---

## Step 4 — Configure Claude Desktop

1. Open Claude Desktop
2. Go to **Settings → Developer → Edit Config**
3. Add the whisper-windows-mcp entry to your config file:

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

> **Important:** If your `claude_desktop_config.json` already has other content (like `"preferences"`), add the `"mcpServers"` block inside the existing `{}` — don't replace the whole file. See the [full config example](#full-config-example) below.

4. Save the file
5. Fully quit Claude Desktop and reopen it
6. Go to **Settings → Developer** — you should see **whisper** listed with a green **running** badge

---

## Step 5 — Test it

In Claude Desktop, type:

> *"Can you check your whisper config?"*

Claude will use the `check_config` tool to verify that `whisper-cli.exe` and your model file are both found correctly before attempting a transcription.

Then try a real transcription:

> *"Please transcribe C:\Users\YourName\Downloads\recording.mp3"*

---

## Converting video to audio before transcribing

Whisper works on audio. If you have a video file (MP4, MKV, etc.), you'll want to extract the audio first — audio-only files are much smaller and process faster.

**Using VLC Media Player (free, easy, recommended):**

1. Open VLC → **Media → Convert / Save**
2. Click **Add** and select your video file
3. Click **Convert / Save**
4. Under **Profile**, choose **Audio - MP3**
5. Set a destination file name and click **Start**

VLC will extract the audio track as an MP3. A 1-hour video that might be 2–4 GB as MP4 typically becomes 50–100 MB as MP3.

**Using FFmpeg (command line, for advanced users):**
```
ffmpeg -i "C:\path\to\video.mp4" -vn -ac 1 -ar 16000 "C:\path\to\output.wav"
```

---

## Output formats

When asking Claude to transcribe, you can specify:

- **text** (default) — plain transcript, no timestamps
- **timestamps** — transcript with `[00:00:00 --> 00:00:05]` time codes, useful for finding specific moments
- **json** — structured output for developers

Example: *"Transcribe this file with timestamps: C:\Users\Me\Downloads\interview.mp3"*

---

## Full config example

If you have other MCP servers configured, your full `claude_desktop_config.json` might look like this:

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

The config file is located at:
```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

---

## Transcription speed

Whisper runs on your CPU by default. Rough estimates for a 1-hour recording:

| Model | Approximate time (CPU) |
|---|---|
| tiny.en | 5–10 minutes |
| base.en | 10–20 minutes |
| small.en | 20–35 minutes |
| medium.en | 35–60 minutes |

These vary significantly based on your processor. A modern CPU with 8+ cores will be faster than these estimates.

> **GPU acceleration** for AMD cards (like the Radeon RX Vega series) via ROCm is not yet covered in this guide but may be added in a future update.

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions to common problems.

Quick checklist if something isn't working:

- [ ] Paths in the config use **double backslashes** (`C:\\whisper\\...`)
- [ ] `whisper-cli.exe` exists at the path you specified
- [ ] The model `.bin` file exists at the path you specified
- [ ] Claude Desktop was fully restarted after editing the config
- [ ] The whisper server shows **running** (not an error) in Settings → Developer

---

## License

MIT — free to use, modify, and distribute.

---

## Contributing

Pull requests welcome. If you've worked out GPU acceleration for AMD or NVIDIA on Windows, please open an issue or PR — it would be a valuable addition.
