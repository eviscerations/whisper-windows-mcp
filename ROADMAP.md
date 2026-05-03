# whisper-windows-mcp — Roadmap

Current version: **v1.9.0**

---

## Completed

### ✅ v1.3.1 — Process Lock (Priority 2)
Added `isWhisperRunning()` check using `tasklist /FI` before any transcription spawn. If `whisper-cli.exe` is already running, returns a clear error with Task Manager instructions rather than spawning a competing process.

### ✅ v1.4.0 — Vulkan GPU Acceleration (Priority 1)
Compiled whisper.cpp from source with `-DGGML_VULKAN=ON` using VS Build Tools 2026 and Vulkan SDK 1.4.341.1. Pre-built Vulkan binaries distributed as a release asset (`whisper-vulkan-win-x64.zip`).

**Results on AMD Radeon RX Vega 56:** GPU utilization ~16%, CPU drops from ~55% to ~15%. A 5-minute file completes in 20–40 seconds instead of 8–12 minutes on CPU.

The official whisper.cpp Windows releases do not include a Vulkan build. The pre-built release in this repo fills that gap for AMD and Intel GPU users.

### ✅ v1.5.0 — System Diagnostics (Priority 9)
New `check_system` tool: detects GPU via `wmic path win32_VideoController`, checks for `ggml-vulkan.dll`, reports VRAM, recommends model size, and gives actionable guidance if GPU binary is missing.

Note: `wmic` reports half the physical VRAM on AMD cards due to a Windows registry limitation. The tool notes this in its output.

### ✅ v1.6.0 — File Pre-Analysis (Priority 3)
New `analyze_media` tool using FFprobe. Single file or folder scan returns duration, size, codec, bitrate, transcription status, and estimated time on CPU and GPU. Folder results are sortable by duration, name, or size.

### ✅ v1.7.0 — Background Transcription + Progress Visibility (Priorities 4 + 5)
Rearchitected transcription to support fully detached background processes:
- `transcribe_audio` now accepts `background=true` — spawns whisper as a detached process, writes a `job.json` state file, returns a job ID immediately (never blocks)
- New `check_progress` tool reads the job file, checks PID liveness, parses whisper's stderr segment timestamps (`[00:01:30 --> 00:01:35]`), and returns percentage complete, elapsed time, and transcript on completion
- Eliminates the 4-minute Claude MCP timeout problem entirely for long files

### ✅ v1.8.0 — Sequential Batch with Validation (Priority 6)
New `start_batch` and `check_batch_progress` tools:
- `start_batch` scans a folder for untranscribed files, sorts by duration, and spawns the first job as a detached process
- `check_batch_progress` automatically validates each completed transcript (empty or suspiciously short outputs are flagged), advances to the next file, and reports overall progress with per-file timestamps
- Validation checks: output exists, is non-empty, line count proportional to audio duration
- 8 files / 8 minutes of audio completed in ~2.5 minutes on GPU

### ✅ v1.9.0 — Multilingual Support and Translation (Priority 7)
Updated `generate_subtitles` with full multilingual support:
- `language=auto` triggers whisper's language auto-detection (30-second probe)
- `translate_to_english=true` runs a second whisper pass with `--translate` flag
- Dual output: `filename.ja.srt` (native) + `filename.en.srt` (English translation)
- Added `.3gp` and `.ts` format support
- `language=auto` also supported in `transcribe_audio`

**Known limitation:** Whisper's built-in translation only targets English. Translating to other languages requires a separate translation step not currently implemented.

---

## In Progress / Planned

### Priority 8 — Filename-Based References Throughout
All tool outputs should reference the full source filename rather than positional indices. Affects batch listings, progress reports, and error messages.

**Status:** Partially implemented. Full audit needed across all tools.

---

### Speaker Diarization
Identify speaker changes in transcripts — not necessarily by name, but marking transitions (e.g. `[Speaker A]`, `[Speaker B]`). Useful for interviews, panel discussions, court recordings.

**Implementation:** Requires [pyannote-audio](https://github.com/pyannote/pyannote-audio) — a Python-based speaker diarization library. Needs a Hugging Face account and model access token. This is a separate dependency stack from the current whisper.cpp pipeline.

**Status:** Planned as an optional advanced feature with separate setup documentation. Not in the main package.

---

### Video Project Workflow Tools (Premiere prep)
Tools for users managing large video editing projects. Designed around the following workflow:

1. Source clips in a parent directory (OBS recordings, downloaded clips, etc.)
2. Edited clips in a `./clips/` subdirectory, derived from sources in the parent
3. Transcription of both directories
4. Transcript text alignment to identify where edited clips appear in the source (timestamp positioning)
5. Semi-automated rename of edited clips with Claude-suggested descriptors, requiring explicit user confirmation before any rename executes
6. Transcript search across a project directory

**Naming convention under discussion:** Preserve source filename information, append subject identifier and optional source timestamp range. Example: `MARKIPLIER_2026-01-11 10-13-22_src-4m12s_keemstar-sourcing.mp4`

**Design principles:**
- Source files are **never renamed or modified**
- All renames require **explicit user confirmation**
- Works with existing directory structure, does not create directories without asking
- Search is a standalone tool that works on any directory with paired .txt transcript files

**Status:** Design phase. Implementation pending real-world directory examples.

---

### Translation to Non-English Languages
Whisper's built-in `--translate` flag only targets English. Supporting arbitrary target languages (e.g. Japanese → German) would require integrating an external translation API or a local translation model, which conflicts with the local-first design principle.

**Options under consideration:**
- LibreTranslate (self-hostable, free)
- Integration with a locally-running LLM for translation
- Out-of-scope documentation pointing users to external tools

**Status:** Deferred. Requires design decision on local-first vs API dependency.

---

### Transcript Cleanup and Formatting
Post-processing transcripts for easier reading and clip scanning:
- Remove filler words and false starts (optional, user-controlled)
- Paragraph breaks at natural topic boundaries
- Speaker-aware formatting when combined with diarization
- Export to formatted PDF or DOCX

**Status:** Planned.

---

## Design Principles

**Minimize Claude API usage.** Every MCP tool call consumes from the user's usage limit. The entire transcription workflow — scan, analyze, queue, run, validate — should require fewer than 20 Claude interactions for a 60-file batch. Free-tier users should be able to use this tool effectively.

**One whisper instance at all times.** Never spawn a second process while one is running. Enforced unconditionally via process lock.

**Local-first, private by default.** No audio leaves the machine. No cloud APIs required for core functionality. This is a feature, not a limitation.

**Modular and composable.** Tools are independent — an attorney transcribing a single court recording doesn't need batch processing. A video editor doesn't need subtitle generation. Users use what they need.

**Explicit user control.** No silent bulk operations. Destructive or irreversible actions (renames, deletes) always require confirmation.

---

## Contributing

Pull requests welcome for any of the above priorities. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your GPU model, VRAM, model size used, and observed throughput.
