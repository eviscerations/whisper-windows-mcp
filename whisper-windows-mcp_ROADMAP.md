# whisper-windows-mcp — Roadmap

Current version is a functional early release. It works, but it has known limitations that make it unsuitable for production use with long files or batch workflows. This document tracks what needs to be fixed and what's planned.

---

## Known Issues (Current Version)

### 1. No Process Lock
Multiple `whisper-cli.exe` instances can be spawned concurrently if Claude retries a timed-out request. This maxes CPU and degrades or breaks both transcriptions. **This is the most critical bug.**

### 2. No Progress Visibility
The user has no indicator that transcription is happening or how far along it is, short of watching Task Manager or listening to their CPU fan. This is not acceptable UX for a public tool.

### 3. 4-Minute Claude MCP Timeout
The Claude web client cuts MCP connections after ~4 minutes. Whisper continues running in the background after the timeout fires, but Claude can't confirm completion. For files longer than ~2-3 minutes of audio on CPU, this timeout is frequently hit.

### 4. No GPU Autodetection
The bundled `whisper-cli.exe` binary is CPU-only. AMD GPUs are not detected or used. NVIDIA GPUs may work depending on the binary source, but there's no verification at startup.

### 5. High CPU Load
Sustained 50-55% CPU utilization during transcription over multi-hour sessions puts significant strain on hardware. GPU acceleration is the primary fix, but binary selection matters too.

### 6. Background Batch Non-Functional
The background batch mode (intended to open a CMD window with progress) does not work as designed and was cut from the current release.

### 7. No File Pre-Analysis
No way to know file duration or size before processing starts. Can't sort a queue by length or estimate how long a job will take.

---

## Roadmap

### Priority 1 — GPU Acceleration

**Problem:** The current `whisper-cli.exe` binary is CPU-only.

**Solution options (in order of recommendation):**

- **Vulkan backend** — Compile whisper.cpp with Vulkan support. Works with AMD, NVIDIA, and Intel GPUs on Windows without vendor-specific SDKs. Best cross-compatibility.
- **ROCm backend** — AMD-native but Windows ROCm support is limited and complex to install.
- **Switch to faster-whisper** — Python-based implementation with GPU support via CuBLAS/ROCm. Often faster than whisper.cpp for equivalent accuracy. Requires Python environment.

**GPU autodetection:** On startup, check for available GPU via `dxdiag` or `wmic path win32_VideoController` and report to the user. If a supported GPU is found but the binary doesn't use it, surface a warning with instructions.

---

### Priority 2 — Process Lock

**Problem:** Retrying a timed-out transcription spawns a second `whisper-cli.exe` while the first is still running.

**Solution:** Before spawning any process, check for existing instances:

```batch
tasklist /FI "IMAGENAME eq whisper-cli.exe" /NH
```

If found, return an error: `"Transcription already in progress. Wait for the current job to complete before starting another."` Do not spawn. Period.

This is a small code change with major impact.

---

### Priority 3 — File Pre-Analysis Tool

**Problem:** No duration/size info before processing. Can't sort intelligently or estimate time.

**Solution:** New tool `analyze_media` using FFprobe (already bundled with FFmpeg):

```
ffprobe -v quiet -print_format json -show_format -show_streams <file>
```

Returns: duration in seconds, file size, codec, bitrate.

For a folder scan, returns a sorted table:

```
filename                    | duration | size   | est. time (CPU) | est. time (GPU)
2026-01-11 10-11-42.mp4    | 0:35     | 42 MB  | ~1 min          | ~10 sec
2026-03-16 06-56-43.mp4    | 1:17     | 98 MB  | ~3 min          | ~20 sec
...
```

Throughput estimates are calibrated from actual completed jobs (logged internally) and refined over time.

---

### Priority 4 — Progress Visibility

**Problem:** No way to know how far along transcription is without Task Manager.

**Solution:** `whisper-cli.exe` outputs segment timestamps to stderr as it processes (e.g. `[00:01:30 --> 00:01:35]`). The MCP should:

1. Pipe stderr from the child process to a log file during processing
2. Expose a `check_progress` tool that reads the log and returns:
   - Last completed timestamp
   - Percentage complete (last timestamp / total duration)
   - Estimated time remaining
   - Whether the process is still running (check PID)

No changes needed to `whisper-cli` itself — only changes to how the MCP monitors it.

---

### Priority 5 — Timeout Workaround (Detached Process Architecture)

**Problem:** The 4-minute Claude MCP timeout kills the connection before long transcriptions finish.

**Solution:** Rearchitect transcription to use fully detached background processes instead of blocking child processes.

Flow:
1. `transcribe_audio` called → spawn whisper as **detached process** → write `job.json` (PID, source file, start time, expected duration, output path, log path) → **return immediately** with job ID
2. `check_progress` called → read `job.json` → check if PID is still alive → read last N lines of log → return status + percentage
3. When `check_progress` returns "complete" → read and return transcript

The transcribe call **never blocks**. It always returns in under a second. The timeout problem disappears entirely.

This is the correct architecture for any long-running MCP tool.

---

### Priority 6 — Sequential Batch with Validation

**Problem:** Background batch mode is non-functional. No post-processing validation.

**Solution:** Rebuild batch mode using the detached process architecture (Priority 5):

1. `transcribe_batch` → runs `analyze_media` on folder → sorts by duration ascending → processes one file at a time using detached process
2. After each file completes, validate: .txt exists + is non-empty + line count is proportional to duration (blank = likely failed)
3. Flag any suspect outputs for re-run
4. Write progress to `batch_progress.log`
5. `check_batch_progress` returns: files done, files remaining, current file, overall ETA, any failed files

---

### Priority 7 — Multi-Language Support and Translation

`whisper-cli` already supports `--language` and `--translate` natively. Expose these properly in the MCP:

- `language` parameter: auto-detect (default) or specify (e.g. `ja`, `es`, `de`)
- `translate_to_english`: boolean flag — uses whisper's built-in translation model
- For dual output (native + translated): two whisper passes, two output files

**Example use case:** Japanese DVD rip → Japanese SRT + English SRT simultaneously. Whisper handles abbreviated subject-drop Japanese better than literal translators because it was trained on natural speech.

---

### Priority 8 — Filename-Based References Throughout

**Problem:** When Claude references transcripts by positional index ("file 2", "file 11"), the user has no frame of reference. The index means nothing outside the tool call context.

**Solution:** All tool outputs — status messages, batch listings, progress reports, analysis results — must reference the **full source filename** at all times. Never use positional indices as the primary identifier.

Bad: `"File 11 is complete."`
Good: `"2025-09-01 03-15-13.mp4 — complete. Transcript saved to 2025-09-01 03-15-13.txt"`

When Claude ingests transcripts for analysis, each content block should be tagged with its source filename so quotes can always be traced back to their origin without ambiguity.

---

### Priority 9 — HWID / System Diagnostics Tool

New tool: `check_system`

Returns:
- GPU vendor and model
- VRAM available
- Whether a GPU-accelerated whisper binary is available and configured
- Recommended whisper model size for available hardware
- Estimated throughput (tokens/sec) based on hardware profile

This makes setup easier for new users and helps diagnose configuration problems without needing to open Task Manager or Device Manager.

---

## Design Principles

**Minimize Claude API usage.** Every MCP tool call consumes from the user's usage limit. Free-tier users have a hard cap. The entire transcription workflow — scan, analyze, queue, run, validate — should require fewer than 20 Claude interactions for a 60-file batch.

**One whisper instance at all times.** Never spawn a second process while one is running. Enforce this unconditionally.

**Local-first, private by default.** No audio leaves the machine. No cloud APIs required. This is a feature, not a limitation.

**Works for free-tier users.** Courtroom transcription, documentary research, foreign film subtitling — these are real use cases for people who can't afford cloud transcription services. The tool should serve them.

---

## Contributing

If you've worked out GPU acceleration for AMD (ROCm or Vulkan) or NVIDIA on Windows, please open an issue or PR — it's the most wanted feature and the implementation details for Windows are non-trivial.

Pull requests welcome for any of the above priorities. Check existing issues before starting work.
