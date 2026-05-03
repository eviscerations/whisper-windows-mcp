# whisper-windows-mcp

A Windows-native MCP (Model Context Protocol) server that lets Claude Desktop transcribe audio files locally using [whisper.cpp](https://github.com/ggml-org/whisper.cpp) — no internet connection required, no data sent to the cloud.

> **Why does this exist?**
> The popular `whisper-mcp` package was built for macOS and assumes a Unix environment. It does not work on Windows. This package was written specifically for Windows users who want the same functionality.

---

## What you can do with it

Once installed, you can say things like this directly in Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe this recording and give me a summary"*
- *"Transcribe with timestamps so I can find specific moments"*
- *"Generate subtitles for this video"*

Everything runs on your own machine. No audio ever leaves your computer.

---

## Requirements

Before installing this package, you need three things set up on your Windows machine:

1. **Node.js 18 or later** — [download from nodejs.org](https://nodejs.org)
2. **whisper.cpp binaries** — the actual transcription engine (see Step 1 below)
3. **A Whisper model file** — the AI model that does the transcription (see Step 2 below)

---

## Step 1 — Install whisper.cpp binaries

### Option A — Pre-built Vulkan release (recommended)

Download `whisper-vulkan-win-x64.zip` from the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases).

This is a custom-compiled build with **Vulkan GPU acceleration** enabled. It works with AMD, NVIDIA, and Intel GPUs on Windows — no vendor-specific SDK required.

Extract the zip to `C:\whisper\Release\`. You should end up with these files:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

**GPU acceleration is automatic** — if a supported GPU is present, whisper.cpp will use it. No additional configuration needed.

### Option B — Build from source

If you prefer to compile your own binary (advanced users):

**Prerequisites:** Git, CMake, Visual Studio Build Tools 2022+ with "Desktop development with C++", Vulkan SDK from [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Copy the resulting binaries from `build\bin\Release\` to `C:\whisper\Release\`.

> **Note:** The default whisper.cpp Windows release on GitHub does not include a Vulkan build. You must either use the pre-built release above or compile from source with `-DGGML_VULKAN=ON`.

---

## Step 2 — Download a Whisper model

Models are downloaded from Hugging Face. Choose one based on your needs:

| Model | File size | Speed | Accuracy | Recommended for |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Very fast | Basic | Quick tests |
| `ggml-base.en.bin` | 142 MB | Fast | Good | Everyday use |
| `ggml-small.en.bin` | 466 MB | Moderate | Better | Important recordings |
| `ggml-medium.en.bin` | 1.5 GB | Fast on GPU | Very good | Best quality |
| `ggml-large-v3.bin` | 2.9 GB | Fast on GPU | Excellent | Maximum accuracy |

**For most people, `base.en` or `small.en` is the best starting point.** With GPU acceleration, `medium.en` and `large-v3` become practical for everyday use.

Download your chosen model from:

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

Save it to `C:\whisper\models\` — create that folder if it doesn't exist.

---

## Step 3 — Install this MCP server

```
npm install -g whisper-windows-mcp
```

Or use `npx` directly in your config (see Step 4).

---

## Step 4 — Configure Claude Desktop

1. Open Claude Desktop
2. Go to **Settings → Developer → Edit Config**
3. Add the whisper-windows-mcp entry:

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

> **Important:** If your `claude_desktop_config.json` already has other content, add the `"mcpServers"` block inside the existing `{}` — don't replace the whole file.

4. Save the file and fully restart Claude Desktop.
5. Go to **Settings → Developer** — you should see **whisper** listed with a green **running** badge.

---

## Step 5 — Test it

In Claude Desktop, type:

> *"Can you check your whisper config?"*

Claude will use the `check_config` tool to verify everything is set up correctly. Then try a transcription:

> *"Please transcribe C:\Users\YourName\Downloads\recording.mp3"*

---

## GPU acceleration

The pre-built Vulkan release enables GPU acceleration automatically. No flags or configuration required — whisper.cpp detects your GPU at startup and uses it if available.

**Confirmed working:** AMD Radeon RX Vega 56 (GCN 5th gen), and any GPU with Vulkan 1.0+ support.

**Performance comparison with medium.en model:**

| Hardware | ~5 min audio file |
|---|---|
| CPU only (Ryzen 7 2700x) | ~8–12 minutes |
| GPU (Vega 56 via Vulkan) | ~20–40 seconds |

GPU utilization during transcription is typically 15–30% — efficient bursts, not sustained load.

---

## Output formats

- **text** (default) — plain transcript
- **timestamps** — transcript with `[00:00:00 --> 00:00:05]` time codes
- **json** — structured output
- **srt** — subtitle file saved next to the source file

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
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin"
      }
    }
  }
}
```

Config file location: `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`

---

## Optional environment variables

| Variable | Description |
|---|---|
| `WHISPER_CLI_PATH` | Path to whisper-cli.exe (required) |
| `WHISPER_MODEL` | Path to model .bin file (required) |
| `WHISPER_THREADS` | CPU thread count override |
| `FFMPEG_PATH` | Path to ffmpeg if not in system PATH |

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

Quick checklist:
- Paths in config use **double backslashes** (`C:\\whisper\\...`)
- `whisper-cli.exe` exists at the path specified
- The model `.bin` file exists at the path specified
- Claude Desktop was fully restarted after editing config
- The whisper server shows **running** in Settings → Developer

---

## License

MIT — free to use, modify, and distribute.

---

## Contributing

Pull requests welcome. See [ROADMAP.md](ROADMAP.md) for planned features.
