# whisper-windows-mcp — Roadmap

Current version: **v2.2.0**

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
Compiled whisper.cpp from source with `-DGGML_VULKAN=ON` using VS Build Tools 2022 and Vulkan SDK. Pre-built Vulkan binaries distributed as `whisper-vulkan-win-x64.zip`.

**Results on AMD Radeon RX Vega 56:** ~16% GPU utilization average. A 58-minute file completes in ~4.5 minutes on GPU vs ~88 minutes CPU-only.

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

### ✅ v2.0.1 — Bug Fixes (shipped in v2.2.0)
- `--max-context 0` hardcoded in both `buildArgs` and `spawnDetached` — prevents hallucination loops on long-form audio. `--condition-on-previous-text` and `--no-context` are not valid flags in the current binary (v1.8.3 era) — `--max-context N` is the correct flag.
- `--no-speech-thold 0.6` hardcoded in both functions — segments below confidence threshold treated as silence rather than hallucinated content.
- Path validation (`validateInputPath`) — rejects UNC paths and `..` traversal.
- `MAX_FILE_SIZE_MB = 10240` file size guard.
- Transcript injection security comment in `transcribeSingle`.
- Broken CLI batch command fixed in TROUBLESHOOTING.md and TROUBLESHOOTING.ja.md — documented the correct FFmpeg pre-conversion approach and `Start-Process -RedirectStandardOutput` method.

### ✅ v2.1.0 — Model Management Suite (shipped in v2.2.0)
- `WHISPER_MODEL` changed from `const` to `let` (session-mutable).
- `MODEL_REGISTRY` — 16 models, full-precision and quantized variants, Hugging Face download URLs.
- `ALLOWED_HF_PREFIXES` — URL whitelist restricting downloads to `ggerganov/whisper.cpp` and `ggml-org` namespaces.
- `list_models` tool — scans models directory, shows active model, sizes, use cases, available downloads.
- `download_model` tool — downloads from Hugging Face via Node.js built-in `https`, atomic rename (callback-before-rename to fix Windows file handle release race).
- `switch_model` tool — validates `.bin` extension, directory constraint, process lock check.
- `recommendedModel()` updated to recommend `large-v3-turbo` for 6GB+ VRAM.

### ✅ v2.2.0 — Quality, Parameter, and Hardware Expansion (current)
- `WhisperOptions` interface replacing positional args in `buildArgs`.
- New parameters in `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- New parameters in `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactored — all quality flags now applied in background/batch mode.
- `runSrtPass` updated to accept `extraOpts`.
- Batch output fix — `readBatchProgress` now moves temp output to final destination before validating (was the root cause of all batch "failed" results).

**Flag compatibility note:** `gpu_device` / `-g` was added in whisper.cpp v1.8.4. The pre-built Vulkan binary in releases is v1.8.3-era — this parameter is accepted by the tool but will have no effect until users update to a v1.8.4+ binary.

**Confirmed valid flags in current binary (v1.8.3 era):**
`--max-context`, `--no-speech-thold`, `--processors`, `--offset-t`, `--duration`, `--best-of`, `--beam-size`, `--diarize`, `--tinydiarize`, `--temperature`, `--prompt`, VAD flags.

**Not in current binary:** `--no-context` (use `--max-context 0`), `--condition-on-previous-text` (Python API name only), `--gpu-device` / `-g` (v1.8.4+).

---

## Critical Bug — Batch Auto-Advance (Confirmed, Fix Pending)

### Batch Does Not Advance Without Active Polling

`start_batch` does not autonomously advance through the queue between files. The batch only progresses when `check_batch_progress` is called. Without polling, the batch stalls indefinitely after each file — whisper-cli.exe exits, no new process spawns, and the queue does not advance.

This breaks unattended overnight batch processing, which is a core design goal of the tool, and directly violates the design principle of minimizing Claude API calls. A 95-file batch of short clips required approximately 200 polling calls over 100 minutes to complete.

**Root cause:** `readBatchProgress` contains all queue advancement logic. It only executes when `check_batch_progress` is explicitly called. There is no background timer, file watcher, or autonomous loop.

**Planned fix — Option B (exit callback, strongly preferred):** Attach an `on('exit')` handler to the spawned whisper-cli child process. When the process exits, immediately invoke advancement logic to validate output and spawn the next job. Event-driven, fires exactly once per file completion, zero polling overhead, zero API calls consumed.

**Option A (fallback only):** Background `setInterval` with duration-aware polling interval derived from FFprobe duration data already present in the batch state JSON. File size is not a reliable proxy for duration.

**Additional constraint:** The fix must not spawn a second whisper-cli.exe while one is already running — the process lock must be respected in the auto-advance path.

**Workaround (current):** Call `check_batch_progress` repeatedly until the batch completes. Approximately one poll per file required.

---

## Planned — Privacy Architecture (Before Bun Migration)

These changes must ship before the Bun migration and before any license changes that facilitate commercial or enterprise adoption. Shipping enterprise-grade tooling without resolved compliance protections creates liability for users in regulated industries.

### `WHISPER_PRIVACY_MODE` Environment Variable
The tool currently guarantees that no **audio** leaves the machine. It does not extend this guarantee to **transcript text** — when transcript content is returned inline in a tool response, that text is processed by Claude's API and leaves the local environment.

This gap is invisible to users who reasonably interpret "no data leaves your machine" to cover all content derived from their audio.

Add `WHISPER_PRIVACY_MODE` as an environment variable in `claude_desktop_config.json`. When enabled:
- All tool responses return only metadata: filename, duration, word count, completion status
- No transcript text is included in any tool response
- Claude cannot read, analyze, or relay transcript content in any form
- The transcript exists only as a local `.txt` file

This is the correct solution for medical, legal, financial, and corporate deployments. Zero API calls, zero data transmission, zero compliance risk.

### Consent Gate for Transcript Content
When `WHISPER_PRIVACY_MODE` is not enabled (default), any tool response that includes transcript text should be preceded by a disclosure on first use per session. The disclosure must clearly communicate that transcript text is transmitted to Anthropic's API, that this is outside the "no data leaves your machine" guarantee, and that users handling regulated content should verify compliance obligations before proceeding.

Implementation: `WHISPER_CONSENT_ACKNOWLEDGED` environment variable defaulting to `false`. On first transcript return per session, if not acknowledged, Claude presents the disclosure and asks for explicit confirmation. Once acknowledged for the session, subsequent transcripts return without re-prompting.

### `PRIVACY.md` Documentation
Create `PRIVACY.md` in the repo root covering:
- What data stays local (always): audio files, video files, model files
- What data may leave local (by default): transcript text in tool responses
- What data never leaves local (with privacy mode): everything
- Compliance framework guidance by industry (HIPAA, GDPR, attorney-client privilege, FERPA, SOX, PCI-DSS, NDA/trade secret)
- How to configure privacy mode
- Disclaimer that the tool authors are not legal advisors

### Tool Schema Privacy Warnings
Update `ListToolsRequestSchema` tool descriptions to include a privacy note on any tool that returns transcript text. This surfaces in Claude Desktop's tool descriptions and creates awareness at the point of use.

### Temp Directory Auto-Cleanup
`%TEMP%\whisper-mcp-jobs\` accumulates job state and log files over time. Add automatic cleanup of completed job files after a configurable retention window (default: 7 days). Currently requires manual `Remove-Item` by the user.

---

## Planned — Bun Migration

Migrate the runtime from Node.js to [Bun](https://bun.sh) after privacy architecture is complete and before v2.3.0 feature additions.

Because Claude Desktop spawns the MCP server fresh on every session startup, startup time is in the critical path. Bun runs TypeScript natively without a compilation step, starts significantly faster than Node, and has faster I/O.

**What changes:**
- Eliminates the `tsc` build step and `dist/` directory
- Users run TypeScript source directly
- `tsconfig.json` becomes optional
- `package.json` scripts updated
- npm publish workflow updated

**What doesn't change:**
- `src/index.ts` source code — Bun is compatible with existing TypeScript and Node.js built-in APIs
- All tool behavior and output formats
- Claude Desktop config for end users

**Why after privacy, before v2.3.0:** The codebase is cleanest to migrate before additional tools are added. Migrating after adds surface area with no benefit. Privacy architecture must be in place first as noted above.

---

## Planned — License Review (After Bun Migration)

The current MIT license permits unlimited commercial use without restriction. Before the tool reaches professional and enterprise markets at scale, the license situation must be evaluated.

**Planned approach — Dual license:**
- MIT for personal and non-commercial use (no change for existing users)
- Separate commercial license for business and enterprise use
- Transition point: next major version release following the Bun migration

**Why not now:** Licensing changes before the privacy architecture is complete would mean selling commercial licenses for a tool with unresolved HIPAA/GDPR compliance gaps. Privacy ships first. License review follows.

The commercial license, tool schema privacy warnings, and `PRIVACY.md` together form the minimum viable compliance story for enterprise buyers.

---

## Planned — v2.3.0: Output Format Expansion

### VTT Subtitle Format
WebVTT (`.vtt`) output alongside SRT. VTT is the web standard used by YouTube, HTML5 `<video>`, and most modern players. whisper-cli supports it natively. Add `vtt` as a valid output format in `transcribe_audio`, `generate_subtitles`, and `spawnDetached`. Update `buildArgs` and all relevant tool schemas, README, and Japanese docs.

### LRC Format
LRC (`.lrc`) lyrics/karaoke format output via `-olrc`. Used by media players for synchronized lyric display. Zero implementation cost — native CLI flag.

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

**Status:** Design phase.

### Speaker Diarization (pyannote-audio)
Full mono speaker diarization with speaker ID labels — marks speaker transitions across an entire recording regardless of channel configuration. Distinct from the built-in `--diarize` stereo flag (v2.2.0) and TinyDiarize.

**Implementation:** Requires [pyannote-audio](https://github.com/pyannote/pyannote-audio) — a Python-based library with a Hugging Face model access token requirement. Entirely separate dependency stack.

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

Japanese and Korean documentation is maintained in parallel with English. The following files must be updated to match English docs after each release:

**Japanese (`*.ja.md`)**
- `README.ja.md`
- `TROUBLESHOOTING.ja.md`
- `ROADMAP.ja.md`
- `PRIVACY.ja.md`
- `SECURITY.ja.md`

**Korean (`*.ko.md`)**
- `README.ko.md`
- `TROUBLESHOOTING.ko.md`
- `ROADMAP.ko.md`
- `PRIVACY.ko.md`
- `SECURITY.ko.md`

Community contributions for other languages welcome.

---

## Contributing

Pull requests welcome. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your GPU model, VRAM, model size, and observed throughput. This helps build an accurate performance reference for other users.
