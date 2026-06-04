# whisper-windows-mcp

A Windows-native MCP (Model Context Protocol) server that lets Claude Desktop transcribe audio and video files locally using [whisper.cpp](https://github.com/ggml-org/whisper.cpp) — with GPU acceleration, multilingual support, and batch processing. All transcription runs locally — no audio, video, or file paths ever leave your machine.

> **Why does this exist?**
> The popular `whisper-mcp` package was built for macOS and assumes a Unix environment. It does not work on Windows. This package was written specifically for Windows users who want local AI transcription integrated with Claude Desktop.

---

## What you can do with it

Once installed, you can say things like this directly in Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe this folder of recordings and save each as a text file"*
- *"Generate Japanese and English subtitles for this video"*
- *"Start a batch transcription of everything in this folder"*
- *"How long will it take to transcribe these files?"*
- *"Check if GPU acceleration is working"*
- *"Transcribe this file in privacy mode"*

---

## Requirements

1. **Node.js 18 or later** — [nodejs.org](https://nodejs.org)
2. **whisper.cpp binaries with Vulkan GPU support** — see Step 1
3. **A Whisper model file** — see Step 2
4. **FFmpeg** — required for video files and non-WAV/MP3 audio

---

## Step 1 — Install whisper.cpp binaries

### Option A — Pre-built Vulkan release (recommended)

Download `whisper-vulkan-win-x64.zip` from the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

This is a custom-compiled build with **Vulkan GPU acceleration** enabled. Works with AMD, NVIDIA, and Intel GPUs — no vendor-specific SDK required.

Extract to `C:\whisper\Release\`. You should end up with:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

GPU acceleration is automatic — no additional configuration needed.

### Option B — Build from source

Requires: Git, CMake, Visual Studio Build Tools 2022+ with "Desktop development with C++", Vulkan SDK from [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Copy the binaries from `build\bin\Release\` to `C:\whisper\Release\`.

> **Note:** The official whisper.cpp Windows releases on GitHub do not include a Vulkan build. You must use the pre-built release above or compile from source with `-DGGML_VULKAN=ON`.

---

## Step 2 — Download a Whisper model

| Model | Size | Speed | Accuracy | Best for |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Very fast | Basic | Quick tests |
| `ggml-base.en.bin` | 142 MB | Fast | Good | Everyday English |
| `ggml-small.en.bin` | 466 MB | Moderate | Better | Important recordings |
| `ggml-medium.en.bin` | 1.5 GB | Fast on GPU | Very good | Best quality English |
| `ggml-large-v3-turbo.bin` | 1.6 GB | Fast on GPU | Excellent | **Recommended for English GPU batch work — ~6x faster than large-v3 with minimal accuracy loss** |
| `ggml-large-v3.bin` | 2.9 GB | Fast on GPU | Excellent | Multilingual, maximum accuracy |
| `ggml-medium.en-q5_0.bin` | 514 MB | Fast | Very good | **Best CPU-only English option — high accuracy at low memory** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Fast | Excellent | **Best CPU-only multilingual option** |
| `ggml-large-v3-q5_0.bin` | 1.1 GB | Moderate on CPU | Excellent | Multilingual, CPU-friendly |

Use `download_model` in Claude Desktop to install any of these directly. For **English-only** use: `large-v3-turbo` (GPU) or `medium.en-q5_0` (CPU) are the best starting points. For **multilingual** use: `large-v3-turbo` or `large-v3-turbo-q5_0` (CPU). English-only models (`*.en.bin`) output `[FOREIGN]` on non-English audio and cannot be used for other languages.

---

## Step 3 — Install FFmpeg

FFmpeg is required for video files and non-native audio formats.

Install via winget:
```
winget install ffmpeg
```

Or download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to your PATH.

Verify:
```
ffmpeg -version
```

---

## Step 4 — Install this MCP server

```
npm install -g whisper-windows-mcp
```

---

## Step 5 — Configure Claude Desktop

Open Claude Desktop → Settings → Developer → Edit Config.

Add the `whisper` entry:

```json
{
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

Config file location: `C:\Users\YourName\AppData\Roaming\Claude\claude_desktop_config.json`

> Use **double backslashes** in all paths.

Save and **fully restart** Claude Desktop. You should see **whisper** listed with a green running badge in Settings → Developer.

---

## Step 6 — Verify your setup

In Claude Desktop, ask:

> *"Check your whisper config"*

Then:

> *"Check your system hardware"*

This confirms your GPU is detected and Vulkan acceleration is active.

---

## Available tools

### `transcribe_audio`
Transcribe a single file. Supports blocking (default) or background mode for long files.

| Parameter | Description |
|---|---|
| `file_path` | Absolute path to the file (required) |
| `language` | Language code (`en`, `ja`, `es`, etc.) or `auto` to detect. Default: `en` |
| `output_format` | `timestamps` (default), `text`, `json`, `srt`, `vtt`, `lrc`, or `csv` |
| `save_to_file` | Save transcript as .txt next to the source file |
| `background` | Run as detached job — returns a job ID immediately. Use `check_progress` to monitor. Recommended for files over 10 minutes. |
| `privacy_mode` | Override privacy mode for this call. `true` = metadata only, no transcript text transmitted. `false` = return text even if `WHISPER_PRIVACY_MODE=true` globally. Omit to use global setting. |
| `threads` | CPU thread override |
| `temperature` | Sampling temperature 0.0–1.0. Default 0.0 (deterministic). |
| `prompt` | Prior context string — improves accuracy for domain-specific vocabulary or speaker names. Example: `"Names: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | Re-enable context conditioning between segments. Default false. |
| `beam_size` | Beam search width. Higher = more accurate, slower. Default 5. |
| `best_of` | Candidate sequences evaluated. Default 5. |
| `gpu_device` | GPU device index for multi-GPU systems. Default 0. |
| `processors` | Parallel processor count. Default 1. |
| `word_timestamps` | One word per timestamped segment. Useful for clip alignment. |
| `max_segment_length` | Max segment length in characters. |
| `diarize` | Stereo speaker diarization — requires stereo audio with speakers on separate channels. |
| `vad_model` | Path to Silero VAD model .bin. Strips silence before transcription — reduces hallucinations on noisy files. |
| `offset_t` | Start offset in milliseconds. |
| `duration` | Process duration in milliseconds from offset. |

**Output formats:**
- `timestamps` — timestamped segments, e.g. `[00:00:01.230 --> 00:00:04.560]  Hello world` (default)
- `text` — plain text, no time codes
- `json` — structured JSON (blocking mode only)
- `srt` — SubRip subtitle file saved next to source
- `vtt` — WebVTT subtitle file saved next to source
- `lrc` — LRC lyrics/karaoke format saved next to source
- `csv` — CSV with timestamps saved next to source

---

### `check_progress`
Monitor a background transcription job started with `transcribe_audio` (background=true).

Returns elapsed time, last processed timestamp, and the full transcript when complete.

| Parameter | Description |
|---|---|
| `job_id` | Job ID returned by `transcribe_audio` |
| `privacy_mode` | Override privacy mode for this check. `true` = metadata only, regardless of how the job was started. |

---

### `start_batch`
Automated sequential batch transcription of all untranscribed files in a folder. Sorts by duration (shortest first), processes one at a time as background jobs, validates each output. Batch self-advances when each file finishes — no polling required.

| Parameter | Description |
|---|---|
| `folder_path` | Path to folder (required) |
| `language` | Language code. Default: `en` |
| `threads` | CPU thread override |
| `output_format` | `timestamps` (default) or `text` |
| `privacy_mode` | Override privacy mode. One confirmation required before batch start; all files then process unattended. No transcript text returned. |

---

### `check_batch_progress`
Monitor a running batch. Automatically advances to the next file when the current one finishes. Returns overall progress, current file with timestamp, and any failed files.

| Parameter | Description |
|---|---|
| `batch_id` | Batch ID returned by `start_batch` |

---

### `transcribe_batch` (interactive)
Process files one at a time with a preview and confirmation before each. Useful when you want to review as you go.

| Parameter | Description |
|---|---|
| `folder_path` | Path to folder (required) |
| `file_index` | Which file to process (1-based). Omit to list files first. |
| `language` | Language code. Default: `en` |
| `recursive` | Include subfolders |
| `output_format` | `timestamps` (default) or `text` |
| `privacy_mode` | Override privacy mode. Confirmation required before each file; metadata only returned. |

---

### `generate_subtitles`
Generate subtitle files. Supports automatic language detection and English translation output. Outputs SRT (widest compatibility) or WebVTT (web and HTML5 video).

| Parameter | Description |
|---|---|
| `file_path` | Path to file (required) |
| `language` | Language code or `auto` to detect. Default: `en` |
| `output_format` | `srt` (default) or `vtt` |
| `translate_to_english` | Also generate an English translation subtitle file. Only applies when source is not English. |
| `background` | Run as detached background job. Returns a job ID for `check_progress`. |
| `threads` | CPU thread override |

When both native and translation are requested, two files are saved next to the source:
- `filename.ja.srt` — original language
- `filename.en.srt` — English translation

> Whisper's built-in translation only translates **to English**. For other target languages, translate the subtitle file contents separately.

---

### `analyze_media`
Analyze files before committing to transcription. Returns duration, size, codec, and estimated transcription time on CPU and GPU. For folders, shows all files in a sortable table with transcription status.

| Parameter | Description |
|---|---|
| `path` | Path to a single file or folder (required) |
| `sort_by` | For folders: `duration` (default), `name`, or `size` |

---

### `check_config`
Verify whisper-cli.exe, the model file, and FFmpeg are all accessible. Run this first if anything is failing.

---

### `list_models`
List all Whisper model files installed in your models directory. Shows filename, size, whether it is currently active, quantization status, and recommended use case. No network calls — reads local filesystem only.

---

### `download_model`
Download a Whisper model directly from Hugging Face into your models directory. Only downloads from trusted Hugging Face namespaces. After downloading, use `switch_model` to activate it.

| Parameter | Description |
|---|---|
| `model_name` | Model name to download, e.g. `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Switch the active Whisper model for the current session without restarting Claude Desktop. Change is session-scoped — does not persist after restart. To make permanent, update `WHISPER_MODEL` in your config.

| Parameter | Description |
|---|---|
| `model_name` | Model filename (e.g. `ggml-large-v3-turbo.bin`) or full path. Must be a `.bin` file in the configured models directory. |

---

### `check_system`
Detect GPU hardware and verify Vulkan acceleration is available. Reports GPU name, VRAM, whether `ggml-vulkan.dll` is present, and recommends the best model size for your hardware.

---

## Supported formats

| Type | Formats |
|---|---|
| Native (no conversion) | `mp3`, `wav` |
| Video (auto-converted via FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Audio (auto-converted via FFmpeg) | `m4a`, `ogg`, `flac` |

---

## GPU acceleration

The pre-built Vulkan release enables GPU acceleration automatically. Tested on AMD Radeon RX Vega 56 (GCN 5th gen). Any GPU with Vulkan 1.0+ support should work, including NVIDIA and Intel Arc.

**Performance comparison (large-v3 model, ~14 minute audio file):**

| Hardware | Time |
|---|---|
| CPU only (Ryzen 7 2700x, 8 threads) | ~22 minutes (estimated) |
| GPU (Vega 56 via Vulkan) | ~3m 22s |

GPU utilization during transcription is typically 15–20%, dropping back to idle between files.

Supports Windows 10 and Windows 11. No Windows 11-specific configuration is required — the tool makes no Win32 API calls and runs on either OS.

---

## Multilingual support

Whisper can auto-detect the spoken language and transcribe in that language. The built-in translation model translates **to English only**.

For best multilingual accuracy, use the `large-v3` model. English-specific models (`*.en.bin`) cannot detect or transcribe other languages.

**Example — foreign language video with subtitles:**
1. Ask Claude to generate subtitles with `language=auto` and `translate_to_english=true`
2. Whisper detects the language and generates a native-language SRT or VTT
3. A second pass generates an English translation
4. Load the SRT in VLC via Subtitle → Add Subtitle File, or use the VTT in any web player

---

## Privacy and compliance

whisper-windows-mcp includes a built-in privacy architecture for sensitive and regulated content.

**Audio and video never leave your machine.** This guarantee is unconditional.

**Transcript text** is different — when returned inline in a tool response, it is processed by Claude's API. For most users this is expected behavior. For regulated content (medical, legal, financial, corporate), privacy mode prevents this.

**Privacy mode** restricts all tool responses to metadata only (filename, word count, save path). No transcript text is transmitted to Claude's API under any circumstances. Enable per-call with `privacy_mode=true` on any transcription tool, or globally via `WHISPER_PRIVACY_MODE=true` in your config.

**Consent gate** — on first use per session in standard mode, a full privacy disclosure is shown before any transcript text is returned. You must explicitly confirm before proceeding. Set `WHISPER_CONSENT_ACKNOWLEDGED=true` in your config to skip this for non-sensitive content.

See [PRIVACY.md](PRIVACY.md) for full compliance guidance (HIPAA, GDPR, attorney-client privilege, FERPA, SOX, PCI-DSS).

---

## Designed for free-tier users

This tool is built to minimize Claude API interactions. The entire transcription workflow — scan, analyze, queue, run, validate — is designed to require as few Claude interactions as possible. Heavy lifting is done locally on your machine.

---

## Optional environment variables

| Variable | Description |
|---|---|
| `WHISPER_CLI_PATH` | Path to whisper-cli.exe (required) |
| `WHISPER_MODEL` | Path to model .bin file (required) |
| `WHISPER_THREADS` | CPU thread count override |
| `FFMPEG_PATH` | Path to ffmpeg if not in system PATH |
| `WHISPER_PRIVACY_MODE` | When `true`, all tool responses return metadata only — no transcript text transmitted to Claude's API. For regulated or confidential content. Can be overridden per-call with the `privacy_mode` parameter. See [PRIVACY.md](PRIVACY.md). |
| `WHISPER_CONSENT_ACKNOWLEDGED` | When `true`, skips the one-time session consent disclosure shown before transcript text is returned. Set after you understand the privacy boundary and no longer need the reminder. Has no effect when privacy mode is active. |

---

## Security

**Binary verification.** To verify the integrity of the whisper-cli.exe binary in the pre-built release, check its SHA256 hash in PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

The expected hash for the v1.4.0 release binary is documented in the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

**Input validation.** All file paths are validated before use — UNC paths (`\\server\share`) and directory traversal sequences (`..`) are rejected. Files over 10 GB are rejected to prevent resource exhaustion.

**Transcript injection awareness.** Audio files can contain spoken content that, when transcribed, resembles instructions. Claude's built-in defenses handle this, but it is worth knowing that transcript content is treated as data — never as instructions — by the MCP server itself.

**Model downloads are restricted.** The `download_model` tool only downloads from two trusted Hugging Face namespaces (`ggerganov/whisper.cpp` and `ggml-org`). Arbitrary URLs are rejected. Redirects are validated against an allowlist before following.

**Model switching is sandboxed.** `switch_model` only accepts `.bin` files within the configured models directory. Paths outside that directory are rejected.

See [SECURITY.md](SECURITY.md) for the full security policy.

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions. See [PRIVACY.md](PRIVACY.md) for compliance guidance if you handle regulated content.

Quick checklist:
- Paths in config use **double backslashes** (`C:\\whisper\\...`)
- `whisper-cli.exe` exists at the configured path
- Model `.bin` file exists at the configured path
- FFmpeg is installed and in PATH (`ffmpeg -version` works)
- Claude Desktop was fully restarted after editing config
- Whisper shows **running** in Settings → Developer

---

## License

**Non-commercial use:** MIT — free for personal, educational, and non-commercial use. See [LICENSE](LICENSE).

**Commercial use:** A separate commercial license is required for any business, professional, or revenue-generating use. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for terms and contact information.

## Contributing

Pull requests welcome. See [ROADMAP.md](ROADMAP.md) for planned features.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your results — GPU model, VRAM, model size, and observed throughput.
