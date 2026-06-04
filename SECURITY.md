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

**Privacy mode gate:** when privacy mode is active, an explicit confirmation disclosure is shown before every transcription operation. This is intentional and cannot be bypassed — regulatory compliance requires per-operation informed consent.

**Consent gate:** in standard mode, a one-time session disclosure is shown before any transcript text is returned to the API for the first time. Set `WHISPER_CONSENT_ACKNOWLEDGED=true` in your config to suppress this for non-sensitive content.

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

## Known design decisions

- **File path injection:** Tools accept absolute file paths from Claude. This is by design — the tool is intended to be used with Claude Desktop by the machine's owner. Do not expose this MCP server to untrusted network access.
- **No sandboxing:** whisper-cli.exe runs with the same permissions as Claude Desktop. This is standard for local MCP tools.
- **Temp files:** Intermediate WAV files are written to `%TEMP%\whisper_tmp_*.wav` and deleted after transcription. Job state files are written to `%TEMP%\whisper-mcp-jobs\` and automatically cleaned up after 7 days on server startup.
- **Transcript content:** Transcript text returned in tool responses is processed by Claude's API in standard mode. Enable `WHISPER_PRIVACY_MODE=true` or pass `privacy_mode=true` per-call to prevent this. See [PRIVACY.md](PRIVACY.md).
- **Transcript injection:** Audio files can contain spoken content that, when transcribed, resembles instructions. Claude's built-in defenses handle this. The MCP server itself marks all transcript content as untrusted data and never interprets it as instructions.
- **Model downloads:** The `download_model` tool only downloads from two trusted Hugging Face namespaces (`ggerganov/whisper.cpp` and `ggml-org`). Redirects are validated against an allowlist before following. Arbitrary URLs are rejected at the code level.
- **Model switching:** `switch_model` only accepts `.bin` files within the configured models directory. Paths outside that directory are rejected regardless of how they are specified.
