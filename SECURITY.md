# Security Policy

## Scope

whisper-windows-mcp is a local-first tool. All audio processing happens on your machine — no audio, video files, or personal data are transmitted to any server. The attack surface is limited to:

- The local filesystem (file paths passed to tools)
- The whisper-cli.exe binary and its dependencies
- The Claude Desktop MCP connection (local IPC only)
- Transcript text returned in tool responses (see Privacy Architecture below)

## Privacy Architecture

**Audio files never leave your machine.** This guarantee is unconditional.

**Transcript text may leave your machine** in standard mode. When a tool response includes transcript text, that text is processed by Claude's API. This is standard MCP behavior but creates a gap between the tool's "local-first" design philosophy and actual data flow for users handling regulated or confidential content.

**Privacy mode** (`WHISPER_PRIVACY_MODE=true` or `privacy_mode=true` per-call) restricts all tool responses to metadata only — no transcript text is ever returned to Claude's API. This is the correct configuration for medical, legal, financial, and corporate deployments.

**Privacy mode gate:** when privacy mode is active, an explicit confirmation disclosure is shown before every transcription operation, keyed per operation (tool + arguments). The server enforces the *block* — it withholds the operation and returns the disclosure on first sight of a given operation. It does **not** enforce that a human answered: the gate clears when the identical call is re-issued, on the assumption that the host surfaced the disclosure and the user replied "yes." A client that re-issues the same call without a human in the loop can satisfy the gate on its own. Treat it as a procedural informed-consent control that depends on the MCP host honoring the disclosure, not as a cryptographic barrier.

**Consent gate:** in standard mode, a one-time session disclosure is shown before any transcript text is returned to the API for the first time. Set `WHISPER_CONSENT_ACKNOWLEDGED=true` in your config to suppress this for non-sensitive content. Note this is a *once-per-session* gate: after the first confirmed transcript, subsequent transcripts in the same session are returned without re-prompting. Use privacy mode for content that must never reach the API regardless of session state.

See [PRIVACY.md](PRIVACY.md) for the full privacy architecture description, compliance framework guidance (HIPAA, GDPR, attorney-client privilege, FERPA, SOX, PCI-DSS), and configuration instructions.

## Binary Verification

To verify the integrity of the `whisper-cli.exe` binary in the pre-built release, check its SHA256 hash in PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

The expected hash for each release binary is published on the [releases page](https://github.com/eviscerations/whisper-windows-mcp/releases). Do not use a binary whose hash does not match.

## Supported versions

Security fixes are applied to the latest published version only.

| Version | Supported |
|---|---|
| 2.x (latest) | ✅ |
| 1.x | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting:
1. Go to the [Security tab](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Click "Report a vulnerability"
3. Describe the issue with enough detail to reproduce it

You'll receive a response within 7 days. If the vulnerability is confirmed, a fix will be released as soon as practical and you'll be credited in the release notes if you wish.

## Sandboxing & approvals

whisper-windows-mcp is a **local, single-user tool driven by the machine's owner through Claude Desktop.** Its threat model is the owner running it on their own machine — not an untrusted, multi-tenant, or network-exposed deployment.

- **Sandboxing:** none, by design. `whisper-cli.exe` runs at the owner's own permission level, the same as any local MCP server. OS-level isolation is not the mitigation here; scope of use is — **do not expose this server to untrusted network access** (see "File path injection" below).
- **Approvals are layered, not sandbox-based:**
  1. **Host approval** — Claude Desktop's MCP layer gates tool invocation.
  2. **Consent / privacy gates** — an explicit confirmation is required before any transcript text leaves the machine for Claude's API; `WHISPER_PRIVACY_MODE` / per-call `privacy_mode` returns metadata only for regulated content. The gate is keyed per operation (tool + arguments). See [PRIVACY.md](PRIVACY.md).
  3. **Input validation** — applied defensively on every tool that takes a path or ID:
     - Directory-traversal (`..`) and UNC (`\\server\share`) paths are rejected on **all** file/folder inputs, including `analyze_media` and `transcribe_batch` (the latter two previously validated only existence — an unvalidated UNC path could induce an outbound SMB connection to an attacker host).
     - `job_id` / `batch_id` are matched against the exact server-minted format before being used to build any filesystem path, so a crafted ID cannot traverse out of the jobs directory into arbitrary file read/write/delete.
     - `switch_model` **and** the `transcribe_audio` `model` override are both contained to the configured models directory via normalized path containment — the override cannot be used to feed an arbitrary file to `whisper-cli` as its model.
     - `vad_model` paths reject traversal/UNC.
     - `download_model` is restricted to an allowlist of trusted Hugging Face namespaces (initial URL and every redirect).
     - Windows system binaries invoked implicitly by the server (`tasklist`, `wmic`) are called by absolute `System32` path so they cannot be shadowed by a same-named executable planted earlier on `PATH`.

**A note on the "untrusted agent" boundary.** This tool is designed for a single owner driving it through Claude Desktop, not as shared or network-exposed infrastructure. However, transcribed audio/video content is itself untrusted input that can *resemble instructions* and influence which tools get called next and with what arguments (see "Transcript injection" below). Because of that, the input validation above is applied defensively rather than relying solely on the single-user assumption. A fully untrusted-agent or multi-tenant posture would still call for OS/container sandboxing and an egress policy — out of scope for a local single-user transcription tool.

## Known design decisions

- **File path injection:** Tools accept absolute file paths from Claude. This is by design — the tool is intended to be used with Claude Desktop by the machine's owner. Traversal (`..`) and UNC paths are rejected on all path-taking tools; absolute local paths are otherwise accepted. Do not expose this MCP server to untrusted network access.
- **Job/batch ID validation:** `job_id` and `batch_id` must match the exact server-minted shape (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`) before they are used to construct any filesystem path. This prevents a crafted ID from traversing out of the jobs directory into arbitrary file read, write, or delete via the job-completion handling.
- **Consent/privacy gates are procedural:** The gates depend on the MCP host surfacing the disclosure and a human replying before the operation is re-issued. The server enforces the block-until-re-issued behavior but cannot verify a human answered. For content that must never reach the API, rely on privacy mode (metadata-only responses), not on the gate alone.
- **No sandboxing:** whisper-cli.exe runs with the same permissions as Claude Desktop. This is standard for local MCP tools.
- **Temp files:** Intermediate WAV files are written to `%TEMP%\whisper_tmp_*.wav` and deleted after transcription. Job state files are written to `%TEMP%\whisper-mcp-jobs\` and automatically cleaned up after 7 days on server startup.
- **Transcript content:** Transcript text returned in tool responses is processed by Claude's API in standard mode. Enable `WHISPER_PRIVACY_MODE=true` or pass `privacy_mode=true` per-call to prevent this. See [PRIVACY.md](PRIVACY.md).
- **Transcript injection:** Audio files can contain spoken content that, when transcribed, resembles instructions. Claude's built-in defenses handle this. The MCP server itself marks all transcript content as untrusted data and never interprets it as instructions.
- **Model downloads:** The `download_model` tool only downloads from two trusted Hugging Face namespaces (`ggerganov/whisper.cpp` and `ggml-org`). Redirects are validated against an allowlist before following, and arbitrary URLs are rejected at the code level. Truncated/incomplete downloads are rejected (Content-Length check) before a `.part` file is promoted to the model name. **Follow-up:** downloads are not yet verified against a per-model SHA256 digest, so a compromised upstream or on-path attacker could still serve a malicious `.bin`. Pinned digests are planned; verify hashes manually against the releases page for high-assurance deployments.
- **Model selection containment:** Both `switch_model` and the `transcribe_audio` `model` override only accept `.bin` files within the configured models directory. Paths outside it are rejected via normalized path containment — a sibling-prefix directory such as `…\models-evil` cannot satisfy the check — regardless of how the path is specified. `vad_model` paths reject traversal/UNC.
- **Implicit system binaries:** `tasklist` and `wmic` are invoked by absolute `System32` path, not by bare name, so they cannot be shadowed by a same-named executable planted earlier on `PATH`.
- **Persistent model server:** the optional `whisper_server` tool runs whisper.cpp's `whisper-server` as a resident process. It is bound to `127.0.0.1` only — never a routable interface — so it is not reachable off the machine. It is started and stopped explicitly (never auto-started), and the owned process is killed on shutdown. Because a resident server and a one-shot `whisper-cli` would contend for the same GPU/VRAM, the two are mutually exclusive: a hard backstop in the detached-spawn path prevents any CLI job from launching while the server is up, and the transcription tools refuse operations that would need the CLI until the server is stopped. `WHISPER_SERVER_PORT` selects the localhost port; the host is not configurable by design.
