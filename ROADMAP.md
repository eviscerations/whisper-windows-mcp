# whisper-windows-mcp — Roadmap

Current version: **v2.0.0**

---

## Design Principles

These principles govern every decision in this project and take precedence over feature velocity.

**Minimize Claude API usage.** The entire transcription workflow — scan, analyze, queue, run, validate, switch models — must be executable with the fewest possible Claude interactions. This tool must be fully functional for free-tier Claude users who are not paying for Pro or Max subscriptions. Every tool call costs usage budget. Design accordingly.

**One whisper instance at all times.** Never spawn a second whisper-cli.exe process while one is running. The process lock is mandatory and non-negotiable.

**Local-first, private by default.** No audio ever leaves the machine. No cloud APIs required for core functionality. Optional integrations (e.g. Hugging Face model downloads) must be clearly documented as optional.

**Explicit user control.** No silent bulk operations. Destructive or irreversible actions require confirmation. Users must always know what is about to happen before it happens.

**Unicode-safe paths.** All file I/O must handle non-ASCII filenames correctly, including Japanese, Chinese, emoji, brackets, and other special characters.

**Modular and composable.** Tools are independent. Users use what they need. No feature should require another to function unless unavoidable.

**Optimization before features.** When in doubt between adding a feature and reducing system load or API call count, reduce load. Heavy optimization passes are expensive. Get the architecture right the first time.

---

## Completed

### ✅ v1.3.1 — Process Lock
Added `isWhisperRunning()` check using `tasklist /FI` before any transcription spawn. Returns a clear error with Task Manager instructions rather than spawning a competing process.

### ✅ v1.4.0 — Vulkan GPU Acceleration
Compiled whisper.cpp from source with `-DGGML_VULKAN=ON` using VS Build Tools 2026 and Vulkan SDK 1.4.341.1. Pre-built Vulkan binaries distributed as `whisper-vulkan-win-x64.zip`.

**Results on AMD Radeon RX Vega 56:** ~16% GPU utilization. A 58-minute file completes in ~4.5 minutes on GPU vs ~88 minutes CPU-only.

### ✅ v1.5.0 — System Diagnostics
`check_system` tool: GPU detection via `wmic`, Vulkan DLL verification, VRAM reporting, model size recommendation.

### ✅ v1.6.0 — File Pre-Analysis
`analyze_media` tool via FFprobe: duration, size, codec, transcription status, CPU and GPU time estimates. Single file or folder scan with sort options.

### ✅ v1.7.0 — Background Transcription + Progress Visibility
Detached process architecture: `transcribe_audio` with `background=true` spawns whisper as a detached process and returns a job ID immediately. `check_progress` parses whisper's stderr segment timestamps for real-time percentage and ETA.

### ✅ v1.8.0 — Sequential Batch with Validation
`start_batch` and `check_batch_progress`: automated sequential processing, transcript validation (empty/short output detection), automatic queue advancement, per-file progress timestamps.

### ✅ v1.9.0 — Multilingual Support and Translation
`generate_subtitles` with `language=auto` detection and `translate_to_english=true` dual-SRT output. Added `.3gp` and `.ts` format support. `language=auto` also available in `transcribe_audio`.

**Known limitation:** Whisper's built-in translation targets English only. Requires `large-v3` model for non-English languages — English-only models (`*.en.bin`) output `[FOREIGN]` on non-English audio.

### ✅ v2.0.0 — Unicode-Safe Paths + Background SRT
**Unicode filenames:** Files with non-ASCII characters in the filename caused background transcription to silently fail. Fixed by routing all output through a sanitized job-ID-based temp path, then moving the result to the correct destination after completion.

**SRT in background mode:** `spawnDetached` previously hardcoded `-otxt` regardless of requested format, and `generate_subtitles` blocked synchronously and hit the 4-minute MCP timeout on longer files. Fixed by adding `outputFormat` parameter to `spawnDetached`, supporting `text` and `srt` output in background mode.

---

## Pending — v2.0.1: Bug Fixes

Confirmed bugs in the v2.0.0 codebase. These are patched before any new features are added.

### Hallucination Prevention Missing from buildArgs
`--condition-on-previous-text` is not passed anywhere in `buildArgs`. Without it, whisper conditions each segment on its own prior output, which causes runaway hallucination loops on low-quality audio, silence, or background noise — producing outputs filled with repeated phrases ("Thank you. Thank you. Thank you.") instead of actual content.

**Fix:** Hardcode `--condition-on-previous-text 0` as a default in `buildArgs`. This is the single most impactful quality flag for long-form audio and must never be omitted. Also expose `--no-speech-thold` as an optional parameter (default `0.6`) so segments below confidence threshold are treated as silence rather than hallucinated into content.

### TROUBLESHOOTING.md CLI Batch Command Broken
The large unattended batch command documented in TROUBLESHOOTING.md passes MP4 files directly to whisper-cli without FFmpeg pre-conversion. whisper-cli cannot read MP4 as WAV — this produces `error: failed to read audio data as wav` for every file.

**Fix:** Replace with the correct FFmpeg pre-conversion approach. Document `Start-Process -RedirectStandardOutput` as the correct PowerShell method for capturing whisper output — whisper writes transcript to stdout and diagnostics to stderr, so piping with `|` and suppressing stderr with `2>$null` captures nothing.

Applies to both `TROUBLESHOOTING.md` and `TROUBLESHOOTING.ja.md`.

### Filename-Based References Throughout
All tool outputs should reference the full source filename rather than positional indices. Affects batch listings, progress reports, and error messages. Full audit of all tool handlers required.

---

## Planned — v2.1.0: Model Management Suite

The highest-priority feature block. Currently users must manually find, download, and configure model files, and the active model is fixed at startup. This creates significant friction and prevents mid-session flexibility. All three tools ship together as a cohesive set.

### `list_models`
Scan the configured models directory and return a formatted table of all installed Whisper model files. For each model: filename, size on disk, whether it is currently active, quantization level if applicable, and recommended use case. No network calls. Reads local filesystem only. Single tool call, single response.

### `download_model`
Fetch a model file directly from Hugging Face into the configured models directory. Accepts a model name and resolves the correct download URL automatically. Supports both full-precision and quantized variants. Reports file size and confirms validity after completion.

Implemented using Node.js built-in `https` or `fetch` (Node 18+ minimum is already required). No new external runtime dependencies.

**Supported models (full-precision):** `tiny.en`, `base.en`, `small.en`, `medium.en`, `large-v3`, `large-v3-turbo`, and multilingual variants.

**Supported models (quantized):** `base.en-q5_1`, `small.en-q5_1`, `medium.en-q5_0`, `large-v3-q5_0`, `large-v3-turbo-q5_0`, and other GGML quantization variants. Quantized models are 40–70% smaller than full-precision with minimal accuracy loss and significantly faster CPU inference — strongly recommended for users without GPU acceleration.

### `switch_model`
Change the active model for the current session without restarting Claude Desktop or editing config files. Validates the file exists, checks no transcription is currently running (process lock enforced), and updates the active model in memory. Session-scoped — does not persist to config.

**Implementation:** Change `WHISPER_MODEL` from `const` to a module-level `let`. `switch_model` updates it directly. Next transcription uses the new model.

### `large-v3-turbo` Documentation
`large-v3-turbo` is a distilled variant of `large-v3` approximately 6x faster with minimal accuracy loss for English conversational content. Documented as the recommended model for English-language batch work where GPU is available. `large-v3-turbo-q5_0` is the recommended option for CPU-only users needing multilingual support.

Updates required: model tables in README and README.ja.md, `check_system` recommendations, `list_models` use-case descriptions, `download_model` supported model list.

---

## Planned — Bun Migration

Migrate the runtime from Node.js to [Bun](https://bun.sh) before the v2.2.0 feature additions.

Because Claude Desktop spawns the MCP server fresh on every session startup, startup time is in the critical path. Bun runs TypeScript natively without a compilation step, starts significantly faster than Node, and has faster I/O — all of which directly benefit this use case.

**What changes:**
- Eliminates the `tsc` build step and `dist/` directory entirely
- Users run TypeScript source directly
- `tsconfig.json` becomes optional / simplified
- `package.json` scripts updated
- npm publish workflow updated

**What doesn't change:**
- `src/index.ts` source code — Bun is compatible with the existing TypeScript and Node.js built-in APIs used throughout
- All tool behavior and output formats
- Claude Desktop config for end users

**Why before v2.2.0:** The codebase is cleanest to migrate now, before additional tools are added. Migrating after adds migration surface area with no benefit.

---

## Planned — v2.2.0: Quality, Parameter, and Hardware Expansion

### `temperature` Parameter
Expose whisper's `--temperature` flag in `transcribe_audio` and `generate_subtitles`. Range 0.0–1.0. Higher values introduce variation in segment decoding and can reduce hallucination on noisy or low-confidence audio at the cost of consistency. Default: `0.0` (deterministic). Low implementation cost — single CLI flag passthrough.

### `prompt` Parameter
Expose whisper's `--prompt` flag in `transcribe_audio` and `generate_subtitles`. Accepts a string injected as prior context before transcription begins. Useful for domain-specific vocabulary, speaker names, or stylistic context. Can meaningfully improve accuracy on specialized content.

Example: `"Names: Keemstar, DramaAlert. This is a streaming commentary recording."`

Low implementation cost — single CLI flag passthrough.

### `--condition-on-previous-text` as User Parameter
Hardcoded to `0` in v2.0.1. Expose as an optional boolean for advanced users who want to re-enable conditioning for structured audio where context continuity helps. Default remains `0`.

### `word_timestamps` Flag
Expose word-level timestamp output using `--max-len 1` combined with `--split-on-word`. This produces per-word output in the standard timestamp format without requiring JSON parsing — a significantly simpler implementation than the `-oj` JSON approach originally planned. Returns a transcript with one word per timestamped segment.

The `--max-len` parameter is also exposed independently as `max_segment_length` for users who want longer segments with controlled line breaks (e.g. for subtitle readability).

### Voice Activity Detection (VAD)
Expose whisper's `--vad` flag with integration into the model management workflow. VAD preprocesses audio through a lightweight Silero model that detects speech segments and strips silence and noise before passing audio to whisper. Results: faster transcription (only speech is processed) and significantly fewer hallucinations (whisper never sees silence to hallucinate over).

**Implementation:** Requires a separate VAD model file (`ggml-silero-v5.1.2.bin` or current equivalent) downloaded from `huggingface.co/ggml-org/whisper-vad`. This model is added as a supported download in `download_model`. The `--vad-model` path is passed alongside `--vad` when VAD is enabled.

**VAD is confirmed stable and Windows-compatible** as of whisper.cpp v1.8.3 (January 2026), with a buffer overflow fix shipped in v1.8.4 (March 2026). Recommend targeting v1.8.4+ binaries.

This is the highest-impact quality addition in this milestone — strongly recommended for batch processing of long or noisy files.

### Built-in Stereo Diarization (`--diarize`)
Expose whisper's native `-di` / `--diarize` flag. For stereo audio files where speakers are recorded on separate channels (left/right), this flag outputs speaker-attributed transcript segments. Zero extra dependencies, no additional models required — purely a CLI flag passthrough.

Distinct from the pyannote-based speaker diarization planned for future releases, which handles mono recordings and requires a separate Python dependency stack. This is the lightweight, zero-cost option for stereo content.

### Time Range Transcription (`--offset-t`, `--duration`)
Expose `--offset-t` (start offset in milliseconds) and `--duration` (processing duration in milliseconds) in `transcribe_audio`. Allows transcribing a specific time window within a file without processing the entire thing. Useful for re-running problem sections of long files, spot-checking output, or extracting specific segments.

### `--beam-size` / `--best-of` Parameters
Expose whisper's beam search controls. `--beam-size` (default 5) controls the breadth of the search — higher values improve accuracy at the cost of speed. `--best-of` (default 5) controls how many candidate sequences are evaluated. Useful for users who want to trade processing time for accuracy on critical files. Low implementation cost — CLI flag passthroughs.

### `--gpu-device` Parameter
Expose the `-g` / `--gpu-device` flag added in whisper.cpp v1.8.4. Allows users with multiple GPUs to specify which device whisper uses by index. Surface the available GPU list in `check_system` output so users know which index corresponds to which device. Relevant for systems with both integrated and discrete GPUs.

### `--processors` Parameter
Expose the `-p` / `--processors` flag for parallel chunk processing across multiple CPU processors. Can reduce processing time on multi-core systems beyond what thread count alone achieves. Low implementation cost.

---

## Planned — v2.3.0: Output Format Expansion

### VTT Subtitle Format
WebVTT (`.vtt`) output alongside SRT. VTT is the web standard used by YouTube, HTML5 `<video>`, and most modern players. whisper-cli supports it natively. Add `vtt` as a valid output format in `transcribe_audio`, `generate_subtitles`, and `spawnDetached`. Update `buildArgs` and all relevant tool schemas, README, and Japanese docs.

### LRC Format
LRC (`.lrc`) lyrics/karaoke format output via `-olrc`. Used by media players for synchronized lyric display. Niche use case but zero implementation cost — native CLI flag.

### CSV Format
CSV (`.csv`) output via `-ocsv`. Structured tabular data with segment timing — useful for downstream analysis, clip alignment workflows, and import into spreadsheet tools. Zero implementation cost — native CLI flag.

---

## Planned — Future Releases

### TinyDiarize
`--tinydiarize` flag support with `tdrz`-enabled model variants (e.g. `large-v2-tdrz`). Unlike the stereo `--diarize` flag, TinyDiarize works on mono recordings. Requires a special model variant download. Lower accuracy than pyannote-based diarization but zero additional dependencies beyond the model file.

**Status:** Planned. Depends on `download_model` supporting tdrz model variants.

### YouTube URL Transcription
Direct transcription from YouTube URLs via yt-dlp. Download audio and transcribe in a single step. Requires yt-dlp installed and in PATH.

**Design constraint:** yt-dlp is optional. Tool must degrade gracefully with clear installation instructions if not found. No change to core functionality for users who don't need it.

### Video Project Workflow Tools
For users managing large video editing projects with source and edited clip directories:

1. Scan source directory and clips subdirectory
2. Fuzzy-match edited clip transcripts against source transcripts to locate origin points
3. Surface Claude-suggested descriptive filenames based on transcript content, requiring explicit user confirmation before any rename executes
4. Transcript search across a project directory with timecode results

**Design constraints:**
- Source files are **never renamed or modified**
- All renames require **explicit user confirmation**
- Search is a standalone tool, usable independently
- Analysis and matching happen locally — Claude is only invoked when the user reviews results, minimizing API calls

**Status:** Design phase. Implementation pending real-world directory structure examples.

### Speaker Diarization (pyannote-audio)
Full mono speaker diarization with speaker ID labels — marks speaker transitions across an entire recording regardless of channel configuration. Distinct from the built-in `--diarize` stereo flag (v2.2.0) and TinyDiarize.

**Implementation:** Requires [pyannote-audio](https://github.com/pyannote/pyannote-audio) — a Python-based library with a Hugging Face model access token requirement. Entirely separate dependency stack from the whisper.cpp pipeline.

**Status:** Optional advanced feature with its own setup documentation. Not included in the main package.

### Translation to Non-English Languages
Whisper's `--translate` flag only targets English. Supporting arbitrary target languages requires an external translation API or local translation model.

**Options under consideration:** LibreTranslate (self-hostable, local-first), local LLM translation, or explicit out-of-scope documentation.

**Status:** Deferred pending design decision on local-first vs API dependency.

### Transcript Cleanup and Formatting
Post-processing pipeline:
- Filler word and false-start removal (optional, user-controlled)
- Paragraph breaks at natural topic boundaries
- Speaker-aware formatting when combined with diarization output
- Export to PDF or DOCX

**Status:** Planned. Speaker-aware variant depends on diarization.

---

## Distribution

Available on [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), and [Glama](https://glama.ai).

---

## Multilingual Documentation

Japanese documentation is maintained in parallel with English. The following files must be updated to match English docs after each release:

- `README.ja.md`
- `TROUBLESHOOTING.ja.md`
- `ROADMAP.ja.md`

Community contributions for other languages welcome.

---

## Contributing

Pull requests welcome. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your GPU model, VRAM, model size, and observed throughput. This helps build an accurate performance reference for other users.
