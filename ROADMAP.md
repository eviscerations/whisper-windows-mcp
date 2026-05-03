# whisper-windows-mcp — Roadmap

Current version is v1.4.0. GPU acceleration via Vulkan is now working. This document tracks what has been completed and what remains.

---

## Completed

### ✅ Priority 1 — GPU Acceleration (v1.4.0)

Compiled whisper.cpp from source with `-DGGML_VULKAN=ON` using Visual Studio Build Tools 2026 and Vulkan SDK 1.4.341.1. Pre-built Vulkan binaries are now distributed as a release asset (`whisper-vulkan-win-x64.zip`).

**Results:** AMD Radeon RX Vega 56 at ~16% GPU utilization, 1.2GB VRAM, CPU at ~15% during transcription. A ~5 minute file that previously took 8–12 minutes on CPU now completes in 20–40 seconds.

The official whisper.cpp Windows releases do not include a Vulkan build ([issue #3673](https://github.com/ggml-org/whisper.cpp/issues/3673)). The pre-built release in this repo fills that gap for AMD and Intel GPU users.

### ✅ Priority 2 — Process Lock (v1.3.1)

Added `isWhisperRunning()` check using `tasklist /FI` before any transcription spawn. If `whisper-cli.exe` is already running, returns a clear error with Task Manager instructions rather than spawning a second competing process.

---

## Known Issues (Remaining)

### 3. 4-Minute Claude MCP Timeout
The Claude web client cuts MCP connections after ~4 minutes. Whisper continues running in the background after the timeout fires, but Claude can't confirm completion. With GPU acceleration this is less frequently hit, but still a concern for very long files or large models.

### 5. No Progress Visibility
The user has no indicator that transcription is happening or how far along it is. whisper-cli.exe outputs segment timestamps to stderr as it processes — the MCP should pipe and expose these.

### 6. Background Batch Non-Functional
A background batch mode was attempted in a previous version but stripped due to no visible feedback. Needs a proper detached process architecture with job state files.

### 7. No File Pre-Analysis
No way to know file duration or size before processing starts.

---

## Roadmap

### Priority 3 — File Pre-Analysis Tool

New tool `analyze_media` using FFprobe:

```
ffprobe -v quiet -print_format json -show_format -show_streams <file>
```

Returns: duration, file size, codec, bitrate, estimated transcription time (CPU and GPU).

---

### Priority 4 — Progress Visibility

whisper-cli.exe outputs segment timestamps to stderr (e.g. `[00:01:30 --> 00:01:35]`). The MCP should:

1. Pipe stderr to a log file during processing
2. Expose a `check_progress` tool returning last timestamp, percentage complete, estimated time remaining, and whether the process is still running

---

### Priority 5 — Timeout Workaround (Detached Process Architecture)

Rearchitect transcription to use fully detached background processes:

1. `transcribe_audio` → spawn whisper as detached process → write `job.json` → return immediately with job ID
2. `check_progress` → read `job.json` → check PID → read log → return status + percentage
3. When complete → read and return transcript

This eliminates the 4-minute timeout problem entirely and unlocks Priority 6.

---

### Priority 6 — Sequential Batch with Validation

Rebuild batch mode on top of Priority 5:

1. `transcribe_batch` → runs `analyze_media` on folder → sorts by duration → processes one file at a time using detached process
2. After each file: validate .txt exists, is non-empty, line count proportional to duration
3. Flag suspect outputs for re-run
4. `check_batch_progress` returns: files done, remaining, current file, ETA, any failed files

---

### Priority 7 — Multi-Language Support and Translation

Expose `--language` and `--translate` flags properly:

- `language` parameter: auto-detect (default) or specify (`ja`, `es`, `de`, etc.)
- `translate_to_english`: boolean — uses whisper's built-in translation model
- Dual output: two whisper passes, two output files

---

### Priority 8 — Filename-Based References Throughout

All tool outputs must reference the full source filename at all times. Never use positional indices as the primary identifier.

---

### Priority 9 — System Diagnostics Tool

New tool `check_system`:

- GPU vendor and model (via `wmic path win32_VideoController`)
- Whether `ggml-vulkan.dll` is present alongside `whisper-cli.exe`
- Recommended model size for available VRAM
- Estimated throughput based on hardware profile
- Actionable guidance if GPU binary is missing

---

## Design Principles

**Minimize Claude API usage.** The entire transcription workflow should require fewer than 20 Claude interactions for a 60-file batch.

**One whisper instance at all times.** Never spawn a second process while one is running.

**Local-first, private by default.** No audio leaves the machine. No cloud APIs required.

**Works for free-tier users.** Courtroom transcription, documentary research, foreign film subtitling — the tool should serve people who can't afford cloud transcription services.

---

## Contributing

Pull requests welcome for any of the above priorities. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your results — GPU model, VRAM, model size, and observed throughput.
