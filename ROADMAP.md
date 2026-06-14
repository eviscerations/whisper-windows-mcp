# whisper-windows-mcp — Roadmap

Current version: **v2.4.0**

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

**SRT in background mode:** `spawnDetached` previously hardcoded `-otxt` regardless of requested format. Fixed by adding `outputFormat` parameter to `spawnDetached`, supporting `text` and `srt` output in background mode.

### ✅ v2.0.1 — Bug Fixes (shipped in v2.2.0)
- `--max-context 0` hardcoded in both `buildArgs` and `spawnDetached` — prevents hallucination loops on long-form audio.
- `--no-speech-thold 0.6` hardcoded in both functions — segments below confidence threshold treated as silence rather than hallucinated content.
- Path validation (`validateInputPath`) — rejects UNC paths and `..` traversal.
- `MAX_FILE_SIZE_MB = 10240` file size guard.
- Transcript injection security comment in `transcribeSingle`.
- Broken CLI batch command fixed in TROUBLESHOOTING.md.

### ✅ v2.1.0 — Model Management Suite (shipped in v2.2.0)
- `WHISPER_MODEL` changed from `const` to `let` (session-mutable).
- `MODEL_REGISTRY` — 16 models, full-precision and quantized variants, Hugging Face download URLs.
- `ALLOWED_HF_PREFIXES` — URL allowlist restricting downloads to `ggerganov/whisper.cpp` and `ggml-org` namespaces.
- `list_models` tool — scans models directory, shows active model, sizes, use cases, available downloads.
- `download_model` tool — downloads from Hugging Face via Node.js built-in `https`, atomic rename.
- `switch_model` tool — validates `.bin` extension, directory constraint, process lock check.
- `recommendedModel()` updated to recommend `large-v3-turbo` for 6GB+ VRAM.

### ✅ v2.2.0 — Quality, Parameter, and Hardware Expansion
- `WhisperOptions` interface replacing positional args in `buildArgs`.
- New parameters in `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- New parameters in `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactored — all quality flags applied in background/batch mode.
- Batch output fix — `readBatchProgress` now moves temp output to final destination before validating.

**Flag compatibility note:** `gpu_device` / `--device` was added in whisper.cpp v1.8.4. The pre-built Vulkan binary in releases is v1.8.3-era — this parameter is accepted by the tool but will have no effect until users update to a v1.8.4+ binary.

### ✅ v2.2.2 — Patch
- Dual license fix — LICENSE and LICENSE-COMMERCIAL.md corrected.
- Minor documentation corrections.

### ✅ v2.3.0 — Batch Auto-Advance, Privacy Architecture, Output Format Expansion

**Batch auto-advance (critical bug fix):** `start_batch` previously required active polling to advance through the queue. An `on('exit')` handler is now attached to each spawned whisper-cli child process. When the process exits, the batch self-advances immediately via the exit callback with zero polling overhead and zero API calls consumed. A mutex prevents double-spawn between concurrent exit handler + `check_batch_progress` calls.

**Privacy architecture:**
- `WHISPER_PRIVACY_MODE` environment variable — when `true`, all tool responses return metadata only (filename, word count, save path). No transcript text is ever transmitted to Claude's API. Transcripts exist only as local files.
- `WHISPER_CONSENT_ACKNOWLEDGED` environment variable — when `true`, suppresses the one-time session consent gate for non-sensitive content.
- `privacy_mode` per-call parameter on `transcribe_audio`, `transcribe_batch`, `start_batch`, and `check_progress`. Overrides the global env var in either direction. No restart required to toggle per-call.
- Privacy mode gate (`checkPrivacyGate()`) — fires before every operation when effective privacy mode is active. Arms on first call (shows disclosure), clears on second (allows). Resets after each operation. Completely independent of the session consent gate.
- Session consent gate (`transcriptPolicy()`) — fires once per session before the first transcript-returning call in standard mode. Consumed by `sessionConsentGiven` flag.
- `PRIVACY.md` — full compliance documentation covering HIPAA, GDPR, attorney-client privilege, FERPA, SOX, PCI-DSS, and NDA/trade secret.
- Tool description privacy warnings on all transcript-returning tools.

**Output format expansion:**
- `vtt` — WebVTT subtitle output via `-ovtt`. Available in `transcribe_audio`, `generate_subtitles`, `start_batch`, and background mode.
- `lrc` — LRC lyrics/karaoke format via `-olrc`. Available in `transcribe_audio` and background mode.
- `csv` — CSV with timestamps via `-ocsv`. Available in `transcribe_audio` and background mode.
- `output_format` default changed from `"text"` to `"timestamps"` across all tools and code paths. Plain text is now opt-in.

**Bug fixes:**
- Bug 1: `output_format` was not forwarded to background jobs — default `"text"` was used regardless of requested format. Fixed by changing default to `"timestamps"` and forwarding correctly.
- Bug 2: Silent `catch {}` in background job output move operation swallowed failures. Added explicit `existsSync` check with detailed failure message after the move.
- Bug 3: Design comment added at the background spawn point documenting why the consent gate is intentionally deferred to `check_progress` for non-privacy background jobs.

**Additional:**
- Temp directory auto-cleanup — `cleanupOldJobFiles()` runs at startup, deletes `.json` and `.log` files older than 7 days from `%TEMP%\whisper-mcp-jobs\`.
- `check_config` now reports privacy mode status.
- Startup log reports privacy mode on/off.
- `Job` interface extended with `privacyMode: boolean` field.
- `BatchState` interface extended with `privacyMode: boolean` field.
- `BackgroundFormat` type excludes `json` (json in background mode remains unsupported — falls back to `text`).

### ✅ v2.4.0 — Hardening, Foreground Guard, Test Suite & CI

A security/robustness pass; the planned Bun migration moved to v2.5.0.

**Security & correctness:**
- `switch_model` path-containment fix — a sibling-prefix directory (e.g. `…\models-evil`) could previously satisfy the "inside the models directory" check via a naive `startsWith`; replaced with normalized, `relative()`-based containment. Closes the escape SECURITY.md describes.
- Privacy/consent gate keyed **per operation** (tool + arguments) — confirming one transcription can no longer satisfy a different operation's gate.
- `download_model` rejects truncated downloads (Content-Length check) before promoting a `.part` file. (Full SHA256 digest verification tracked for a later pass.)
- Input coercion — numeric tool parameters that aren't real numbers are dropped rather than handed to whisper-cli as `NaN`.

**Robustness:**
- **Foreground timeout guard** — a file long enough to exceed Claude Desktop's ~4-minute MCP tool timeout in blocking mode is detected up front and routed to background instead of silently timing out. Threshold configurable via `WHISPER_FOREGROUND_MAX_SEC`. Time estimates corrected (the old GPU estimate badly under-predicted; the dominant model-reload cost is now modeled — measured, not guessed).
- Atomic job/batch state writes (temp-file + rename) so a concurrent reader can't observe a torn JSON file.
- Collision-proof job/batch/temp IDs (UUID-suffixed).
- Graceful SIGINT/SIGTERM shutdown that cleans up blocking-mode temp files.

**GPU device selection:**
- `WHISPER_GPU_DEVICE` env var, and `gpu_device` now plumbed through `generate_subtitles` and the language-detect pass (was `transcribe_audio` only). `check_config` reports the active device. `check_system` no longer misreports a driver issue when `wmic` (deprecated on Windows 11 24H2+) returns nothing.

**Quality:**
- A `node:test` unit-test suite over the pure logic (path containment, gate keying, atomic writes, input coercion, the timeout estimate), zero added dependencies, plus a GitHub Actions CI workflow running it on every push/PR.

**Identified for a future release:** a persistent-model path (e.g. whisper.cpp's `whisper-server`) to eliminate the model-reload cost paid on every transcription — a large throughput win for batch/archive work.

---

## Planned — v2.5.0: Bun Migration

Migrate the runtime from Node.js to [Bun](https://bun.sh).

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

---

## Planned — v2.5.0: Enhanced Output Formats for External Tool Integration

Extended output format support targeted at downstream analysis and integration workflows. Exact scope to be defined based on user feedback post-v2.3.0.

---

## Planned — v2.6.0: Live Microphone Transcription Mode

Real-time transcription from a live microphone input. Stream audio from a selected recording device to whisper in chunks, returning rolling transcript segments as they complete.

**Design constraints:**
- Device selection must be explicit — no silent default device capture
- User must be able to stop the stream via a Claude Desktop interaction
- Must not conflict with the one-whisper-instance-at-a-time constraint
- Latency vs accuracy trade-off must be user-configurable

**Status:** Design phase. Depends on a stable streaming API in whisper.cpp.

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

## Licensing

whisper-windows-mcp is dual-licensed.

**Non-commercial use:** MIT — free for personal, educational, and non-commercial use. See [LICENSE](LICENSE).

**Commercial use:** A separate commercial license is required for any business, professional, or revenue-generating use. See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for terms and contact information.

---

## Distribution

Available on [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai), and [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR submitted).

---

## Multilingual Documentation

The following files must be updated to match English docs after each release:

**Japanese (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Korean (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamese (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesian (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ukrainian (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Brazilian Portuguese (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Spanish (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polish (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Romanian (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Community contributions for other languages welcome.

---

## Contributing

Pull requests welcome. Check existing issues before starting work.

If you've tested GPU acceleration on hardware not listed above, please open an issue with your GPU model, VRAM, model size, and observed throughput. This helps build an accurate performance reference for other users.
