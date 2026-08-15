# whisper-windows-mcp — Roadmap

Current version: **v2.5.0**

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

### ✅ v2.5.0 — Persistent Model Server + TinyDiarize

**Persistent model server (Phase 1).** whisper-cli is one-shot: it reloads the full model on every call — v2.4.0 measured that reload at ~110s on a memory-constrained GPU, a fixed per-file tax that dominates wall-clock on batch/archive work. v2.5.0 adds an optional resident-model mode that keeps the model in memory between transcriptions.
- `whisper_server` tool (`start` / `stop` / `status`). The resident server *becomes* the single instance, preserving the one-whisper-instance rule: requests serialize against it, no concurrency introduced.
- Blocking `transcribe_audio` and `transcribe_batch` route through the resident server over localhost (`127.0.0.1`) via `POST /inference`, skipping the reload cost. The foreground-timeout guard is skipped in server mode (no reload to pay).
- `switch_model` hot-swaps the resident model via `POST /load` with no restart. `check_config` reports server state; the owned server is killed on shutdown to release VRAM.
- One-engine / shared-VRAM rule enforced with a hard backstop in the detached-spawn path plus friendly refusals: while the server is up, background jobs, `start_batch`, `generate_subtitles`, `lrc`/`csv` output, and per-request options the HTTP API doesn't honor (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, etc.) are refused with a "stop the server first" message rather than silently degrading.
- Config: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (default 8571, localhost-only).

**Design constraints:**
- Explicit lifecycle: start / stop / status, with a health check. The server is never started silently as a side effect of an unrelated call.
- Bind to localhost only — never a routable interface. No network exposure (consistent with the local-first principle and the v2.4.0 hardening).
- Graceful fallback: if the server isn't running, transcription still works via the existing one-shot whisper-cli path. The server is an optimization, not a hard dependency.
- `switch_model` reloads the model in the resident server (still far cheaper amortized than reloading per file).
- Privacy and consent gates are unchanged — they sit above the transcription mechanism.
- Port selection with collision handling; clean shutdown on SIGINT/SIGTERM alongside the existing temp-file cleanup.

**TinyDiarize.** `--tinydiarize` support with `tdrz`-enabled models. Unlike the stereo `--diarize` flag (v2.2.0), TinyDiarize marks speaker turns on **mono** recordings and needs nothing beyond the model file — no Python, no external service.
- `tinydiarize` parameter on `transcribe_audio` and `generate_subtitles` (blocking and background modes); `--tinydiarize` threaded through both arg builders.
- `small.en-tdrz` added to `MODEL_REGISTRY` so `download_model` can fetch it from the existing trusted Hugging Face namespaces.

---

## Planned — v2.6.0: Persistent Model Server — Phase 2

Route background jobs and `start_batch` through the resident server. Phase 1 (v2.5.0) covers blocking transcription only; this is the larger archive/throughput win, and needs the job/queue layer reworked around HTTP requests instead of detached PIDs — progress tracking without a PID, and HTTP-based cancellation.

The resident-server **design constraints** established in v2.5.0 continue to govern Phase 2 — localhost-only bind, explicit lifecycle, graceful one-shot fallback, and unchanged privacy/consent gates. Phase 2 adds the job/queue routing without relaxing any of them.

**Status:** Planned.

---

## Planned — v2.7.0: Project-Wide Transcript Search

A standalone tool to search a phrase or pattern across every transcript in a project directory and return matches with their source file and timecode. Decomposed from the larger video-project workflow (see "Later / Under Consideration") — this half is independently useful, low-risk, and API-light: the search runs locally, and Claude is only involved when the user reviews results.

**Status:** Planned.

---

## Planned — v2.8.0: Editor-Importable Output & Integration Formats

Turn transcripts into artifacts a video editor imports directly, so transcription feeds the edit instead of stopping at a text file — the core motivation for the project: making a large raw-footage archive workable for a solo creator.

- **Marker CSV first** — segment starts as a marker/chapter CSV that Premiere, Resolve, and YouTube import natively. Delivers most of the "get it into my editor" value at a fraction of the cost and version-fragility of a full timeline format.
- **Word-level timing data** — expose whisper.cpp full-token JSON (`--output-json-full` / `-ojf`) and DTW-aligned word timestamps (`--dtw <preset>`, auto-matched to the active model; presets exist for every family including `large.v3.turbo`, and apply to quantized models). This is the accurate-timing layer that word-level SRT, marker placement, and clip alignment sit on; the per-token JSON also carries confidence values for anyone who wants them. Note: `--dtw` is a **load-time/context flag** (set at model init, not per request), so it lives in the one-shot CLI path — the resident `whisper-server` `/inference` API cannot apply it per-request, consistent with the server-mode word-level refusal in v2.5.0.
- **Close the JSON-in-background gap** — JSON currently falls back to text in background mode.
- **FCPXML / EDL — deferred:** verbose, version-sensitive, and pulls toward editor-integration scope. Revisit only if marker CSV proves insufficient.

**Scope boundary:** this generates files the editor *imports* — it does not automate the editor's UI. Standard interchange is on-ethos and dependency-light; driving the application is a separate concern.

Pairs with v2.7.0: search the archive to find the moment, then hand the editor a marker file to jump straight to it.

---

## Planned — v2.9.0: Transcription Quality & Tuning

Depth on transcription accuracy and control — all zero-dependency passthroughs of whisper.cpp flags the wrapper doesn't yet expose. Every option here is a one-shot transcription parameter: no added tool-call overhead, fully functional for free-tier users.

- **VAD tuning** — the voice-activity-detection knobs (`--vad-threshold`, min-speech / min-silence / max-speech duration, speech-pad, samples-overlap). VAD is already on but not tunable; these fix the over- and under-segmentation behind most real-world quality complaints.
- **Non-speech-token suppression** (`--suppress-nst`) — drop `[music]` / noise artifacts for cleaner transcripts.
- **Language detection only** (`--detect-language`) — a cheap "what language is this?" probe that returns without a full transcription pass. Valuable for the multilingual audience and for routing before transcription.
- **Robustness / decoding thresholds** — `--entropy-thold`, `--logprob-thold`, `--word-thold`, `--no-fallback`, `--temperature-inc`, `--carry-initial-prompt`, `--suppress-regex` for difficult audio.
- **Performance knobs** — flash attention (now **default-on** in current whisper.cpp; expose the `--no-flash-attn` / `-nfa` disable path rather than treating it as opt-in), CPU-only (`--no-gpu`), audio-context size (`--audio-ctx`).

**Status:** Planned.

---

## Planned — v3.0.0: Subtitle Post-Processing Suite

A pure-TypeScript batch layer over the SRT / VTT / JSON the server already emits — no re-transcription, no new dependencies, one shared parser/serializer. Mirrors the "batch convert" chain of dedicated subtitle editors (Subtitle Edit, Aegisub), which no competing transcription MCP offers. The timing-repair pass in particular targets the defects raw Whisper output exhibits — blank cues on silence, overlapping or too-short segments, repeat-loop duplicates, over-long lines — so the suite cleans up this server's *own* output, not just imported files.

- **Timing repair & validation** — enforce min / max cue duration; fix overlapping cues; apply a minimum inter-cue gap; bridge sub-threshold gaps (extend-to-next); drop empty cues; merge duplicate cues (whisper repeat-loops); cap at two lines; sort + renumber. Plus a non-mutating **lint report** that flags per-cue reading-speed (CPS), chars-per-line, and line-count violations against a selectable profile (e.g. YouTube 42 CPL / 20 CPS, Netflix 42 / 17) — the deliverable editors actually want before import.
- **Re-timing** — offset / shift all cues; frame-rate re-time (e.g. 23.976 ↔ 25).
- **Reflow** — merge short cues; split long lines to a max chars-per-line / chars-per-second, balancing the two lines rather than a greedy split.
- **Format conversion** — convert existing files between SRT / VTT / LRC / CSV / Markdown / plain, plus ASS/SSA output (default-styled), without re-transcribing. UTF-8 / line-ending normalization on write (satisfies YouTube's UTF-8 requirement, prevents mojibake on re-import).
- **Text cleanup** — find/replace (regex opt-in), filler-word removal from a static wordlist (not an LLM), casing normalization, strip hearing-impaired annotations. Strictly mechanical — anything needing judgement (OCR repair, punctuation inference) stays out; the host Claude handles that on returned text.
- **Speaker-label formatting** — format existing stereo / TinyDiarize turns as speaker-prefixed blocks.
- **Summary statistics** — word count, duration, WPM, average CPS, silence ratio.

**Design constraints:**
- Pure TypeScript over the SRT / VTT / JSON the server already emits — no re-transcription, no new runtime dependencies, one shared parser/serializer.
- Operates only on existing subtitle/transcript files — never invokes whisper or ffmpeg, never touches audio.
- Deterministic and rule-based only — no LLM, no cloud, no "smart" repair. Anything needing judgement (OCR fixes, punctuation inference) stays out; the host Claude handles that on returned text.
- Non-destructive — writes new files; never overwrites a source file in place without explicit user confirmation.
- The lint / validation pass is non-mutating — it reports violations, it never silently rewrites.
- Standard interchange formats only — never drives an editor's UI.

**Status:** Planned.

---

## Later / Under Consideration

Not scheduled, but on-ethos and revisited as capacity allows.

### Bun Migration
Migrate the runtime from Node.js to [Bun](https://bun.sh) to cut MCP-server cold-start time and drop the `tsc` build step (source runs directly). Demoted from its former v2.5.0 slot: with the per-invocation model-reload cost being the real bottleneck (see v2.5.0 above), shaving Node's startup is a marginal gain, and Bun-on-Windows maturity plus a distribution-model change carry risk. Worth doing eventually as an optional optimization, not a priority.

### Video Project Rename & Match Workflow
The heavier half of the project tooling, once Project-Wide Transcript Search (v2.7.0) lands: fuzzy-match edited clip transcripts against source transcripts to locate origin points, and surface Claude-suggested descriptive filenames.

**Design constraints:**
- Source files are **never renamed or modified**
- All renames require **explicit user confirmation**
- Analysis and matching happen locally — Claude is only invoked when the user reviews results, minimizing API calls

**Status:** Design phase.

### Rule-Based Transcript Cleanup
Local, deterministic post-processing — filler word and false-start removal, user-controlled. Most valuable for privacy-mode users, where the transcript never reaches Claude for cleanup. Deliberately narrow: paragraph-breaking and topic segmentation are things Claude already does well on returned text, and PDF/DOCX export is scope creep into document generation — both out of scope here.

**Status:** Promoted — the deterministic cleanup is scheduled in the v3.0.0 Subtitle Post-Processing Suite; the out-of-scope notes (paragraph-breaking, PDF/DOCX) still hold.

### Speaker Diarization (pyannote-audio)
Full mono speaker diarization with speaker ID labels across an entire recording. Distinct from the built-in stereo `--diarize` flag (v2.2.0) and TinyDiarize (v2.5.0).

**Implementation:** requires [pyannote-audio](https://github.com/pyannote/pyannote-audio) — a Python library with a Hugging Face access-token requirement, an entirely separate dependency stack. Deprioritized: it clashes with the local-first / zero-dependency ethos, and TinyDiarize already covers the zero-dependency mono case. If pursued, it ships as an optional advanced add-on with its own setup docs, never in the main package.

**Status:** Deprioritized / optional.

### Translation to Non-English Languages
Whisper's `--translate` flag only targets English. Arbitrary target languages need an external translation API or a local translation model.

**Options under consideration:** LibreTranslate (self-hostable, local-first), local LLM translation, or explicit out-of-scope documentation.

**Status:** Deferred pending a local-first vs API-dependency decision.

---

## Out of Scope / Not Planned

Features intentionally excluded, recorded here so the decision is explicit and doesn't resurface repeatedly.

### Live Microphone Transcription — not planned
Real-time transcription from a live mic was previously slated for v2.7.0. Cut because it conflicts with the project's core design:
- **Architecture mismatch:** MCP is request/response, not streaming. Live capture would require either continuous polling (burns API budget) or a long-blocking call that hits the v2.4.0 foreground-timeout guard.
- **One-instance / minimize-API principles:** returning rolling segments to Claude is constant tool-call churn — the opposite of "functional for free-tier users" — and a long-lived streaming process strains the process lock.
- **External dependency:** it would require an additional external dependency.

Live captioning is a distinct product category (low latency, device management, VAD) from a file/batch transcription tool. Users needing it are better served by a dedicated real-time tool.

### YouTube URL Transcription (yt-dlp) — not planned as a bundled tool
Direct YouTube-to-transcript via yt-dlp was previously planned. Dropped as a first-class feature because:
- **Security surface:** it adds arbitrary-URL fetching and a subprocess call with user-controlled input, reversing the v2.4.0 hardening that reduced exactly that surface.
- **Maintenance:** yt-dlp breaks frequently as YouTube changes — an ongoing maintenance commitment.
- **Local-first & licensing:** network content acquisition sits outside the local-first scope, and bundling a downloader into a commercially-licensed project is a ToS/liability gray area.
- **Redundant:** users can run yt-dlp themselves and point `transcribe_audio` at the resulting file.

**Alternative:** documented as a recipe (run yt-dlp, then transcribe the file) in README / TROUBLESHOOTING, rather than a maintained tool — the workflow stays available without owning the dependency or the attack surface.

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
