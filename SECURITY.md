# Security Policy

## Scope

whisper-windows-mcp is a local-only tool. All audio processing happens on your machine — no audio, transcripts, or personal data are transmitted to any server. The attack surface is therefore limited to:

- The local filesystem (file paths passed to tools)
- The whisper-cli.exe binary and its dependencies
- The Claude Desktop MCP connection (local IPC only)

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
- **Temp files:** Intermediate WAV files are written to `%TEMP%\whisper_tmp_*.wav` and deleted after transcription. Job state files are written to `%TEMP%\whisper-mcp-jobs\` and persist until manually cleared.
