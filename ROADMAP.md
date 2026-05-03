# whisper-windows-mcp — Roadmap

Current version: **v1.9.0**

---

## Completed

### ✅ v1.3.1 — Process Lock (Priority 2)
Added `isWhisperRunning()` check using `tasklist /FI` before any transcription spawn. Returns a clear error with Task Manager instructions rather than spawning a competing process.

### ✅ v1.4.0 — Vulkan GPU Acceleration (Priority 1)
Compiled whisper.cpp from source with `-DGGML_VULKAN=ON` using VS Build Tools 2026 and Vulkan SDK 1.4.341.1. Pre-built Vulkan binaries distributed as `whisper-vulkan-win-x64.zip`.

**Results on AMD Radeon RX Vega 56:** ~16% GPU utilization. A 58-minute file completes in ~4.5 minutes on GPU vs ~88 minutes CPU-only.

### ✅ v1.5.0 — System Diagnostics (Priority 9)
`check_system` tool: GPU detection via `wmic`, Vulkan DLL verification, VRAM reporting, model size recommendation.

### ✅ v1.6.0 — File Pre-Analysis (Priority 3)
`analyze_media` tool via FFprobe: duration, size, codec, transcription status, CPU and GPU time estimates. Single file or folder scan with sort options.

### ✅ v1.7.0 — Background Transcription + Progress Visibility (Priorities 4 + 5)
Detached process architecture: `transcribe_audio` with `background=true` spawns whisper as a detached process and returns a job ID immediately. `check_progress` parses whisper's stderr segment timestamps for real-time percentage and ETA.

### ✅ v1.8.0 — Sequential Batch with Validation (Priority 6)
`start_batch` and `check_batch_progress`: automated sequential processing, transcript validation (empty/short output detection), automatic queue advancement, per-file progress timestamps.

### ✅ v1.9.0 — Multilingual Support and Translation (Priority 7)
`generate_subtitles` with `language=auto` detection and `translate_to_english=true` dual-SRT output. Added `.3gp` and `.ts` format support. `language=auto` also available in `transcribe_audio`.

**Known limitation:** Whisper's built-in translation targets English only. Requires `large-v3` model for non-English languages — English-only models (`*.en.bin`) output `[FOREIGN]` on non-English audio.

---

## Fixed in v2.0.0

### ✅ Unicode / Special Character Filenames
Files with Unicode characters (Japanese, Chinese, emoji, brackets) in the filename cause background transcription to silently fail — whisper runs to completion but cannot write the output file to the path.

**Fix:** Route output through a sanitized temp path derived from a hash or job ID, then move the result to the correct destination after completion. Never pass the raw source path as the `-of` argument.

### ✅ SRT Output in Background Mode
`spawnDetached` hardcodes `-otxt`. `generate_subtitles` blocks synchronously, which hits the 4-minute MCP timeout on files longer than ~4 minutes.

**Fix:** Add `outputFormat` parameter to `spawnDetached`. Background mode should support `text`, `srt`, and `timestamps` output formats.

---

## Planned

### Priority 8 — Filename-Based References Throughout
All tool outputs should reference the full source filename rather than positional indices. Affects batch listings, progress reports, and error messages. Full audit needed.

---

### Speaker Diarization
Identify speaker transitions in transcripts — marking changes without necessarily naming speakers (e.g. `[Speaker A]`, `[Speaker B]`). Useful for interviews, panels, court recordings.

**Implementation:** Requires [pyannote-audio](https://github.com/pyannote/pyannote-audio) — a Python-based speaker diarization library requiring a Hugging Face account and model access token. Separate dependency stack from the current whisper.cpp pipeline.

**Status:** Planned as an optional advanced feature with separate setup documentation. Not in the main package.

---

### Video Project Workflow Tools (Premiere prep)
Tools for users managing large video editing projects:

1. Source clips in a parent directory
2. Edited clips in a `./clips/` subdirectory
3. Transcript text alignment — identify where edited clips appear in the source by fuzzy-matching transcript text
4. Semi-automated rename with Claude-suggested descriptors, requiring explicit user confirmation before any rename executes
5. Transcript search across a project directory

**Design principles:**
- Source files are **never renamed or modified**
- All renames require **explicit user confirmation**
- Search is a standalone tool, usable independently

**Status:** Design phase. Implementation pending real-world directory examples.

---

### Translation to Non-English Languages
Whisper's `--translate` flag only targets English. Supporting arbitrary target languages (e.g. Japanese → German) requires an external translation API or local translation model.

**Options under consideration:** LibreTranslate (self-hostable), local LLM translation, or out-of-scope documentation.

**Status:** Deferred pending design decision on local-first vs API dependency.

---

### Transcript Cleanup and Formatting
Post-processing for easier reading and clip scanning:
- Remove filler words and false starts (optional, user-controlled)
- Paragraph breaks at natural topic boundaries
- Speaker-aware formatting when combined with diarization
- Export to formatted PDF or DOCX

**Status:** Planned.

---

### Multilingual Documentation
Japanese documentation (`README.ja.md`) is complete. Additional translations planned:
- `TROUBLESHOOTING.ja.md`
- `ROADMAP.ja.md`

Community contributions for other languages welcome.

---

## Design Principles

**Minimize Claude API usage.** The transcription workflow — scan, analyze, queue, run, validate — should require fewer than 20 Claude interactions for a 60-file batch. Free-tier users should be able to use this tool effectively.

**One whisper instance at all times.** Never spawn a second process while one is running.

**Local-first, private by default.** No audio leaves the machine. No cloud APIs required for core functionality.

**Modular and composable.** Tools are independent. Users use what they need.

**Explicit user control.** No silent bulk operations. Destructive or irreversible actions require confirmation.

**Unicode-safe paths.** All file I/O must handle non-ASCII filenames correctly, including Japanese, Chinese, emoji, and special characters.

---

## Contributing

Pull requests welcome. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your GPU model, VRAM, model size, and observed throughput.


### Model Management Tools
- `list_models` — list installed Whisper models with file sizes and download status
- `install_model` — download a model from Hugging Face directly to the models directory

### Additional Parameters
- `temperature` — expose whisper's `--temperature` flag (0.0–1.0). Higher values reduce hallucination on noisy audio. Low effort addition.
- `prompt` — expose whisper's `--prompt` flag for context injection (e.g. "This is a legal deposition"). Improves domain-specific vocabulary accuracy.

### VTT Subtitle Format
WebVTT (`.vtt`) format support alongside SRT. VTT is the web standard used by YouTube, HTML5 `<video>`, and many modern players.

### YouTube URL Transcription
Direct transcription from YouTube URLs via yt-dlp. Download + transcribe in one step without manually saving the video first. Requires yt-dlp to be installed.
