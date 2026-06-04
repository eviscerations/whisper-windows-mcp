# Privacy Architecture — whisper-windows-mcp

This document describes what data stays on your machine, what data leaves your machine, and how to configure the tool for regulated or sensitive content.

---

## The core guarantee

whisper-windows-mcp is built on a local-first architecture. **Audio and video files never leave your machine.** Transcription runs entirely on your hardware using whisper.cpp — no cloud service, no internet connection, no API call is involved in the transcription itself.

This guarantee is unconditional for media files.

---

## What data stays local (always)

| Data | Leaves machine? |
|---|---|
| Audio files | ❌ Never |
| Video files | ❌ Never |
| Whisper model files | ❌ Never |
| Temp WAV conversion files | ❌ Never (deleted after transcription) |
| Batch state and job files | ❌ Never |
| Transcript `.txt` / `.srt` / `.vtt` files on disk | ❌ Never |

---

## What data may leave your machine (standard mode)

When a tool response includes transcript text, that text is returned to Claude Desktop and processed by Anthropic's API. This is standard MCP behavior — the text travels from the local MCP server to Claude's model over the network.

| Data | Leaves machine? |
|---|---|
| Transcript text returned inline in tool responses | ✅ Yes, in standard mode |
| Transcript text uploaded directly to Claude as a file | ✅ Yes (outside MCP entirely — no privacy control applies) |

This gap exists between the tool's "no data leaves your machine" guarantee and the actual behavior when you ask Claude to read, summarize, or analyze a transcript. Most users — those transcribing public content like YouTube videos, podcasts, or streaming recordings — are unaffected by this distinction.

For users handling private, confidential, or regulated recordings, this distinction matters.

---

## Privacy Mode

`WHISPER_PRIVACY_MODE` restricts all tool responses to metadata only. When active:

- Tool responses return only: filename, word count, save path, completion status
- No transcript text is included in any tool response, ever
- Claude cannot read, analyze, or relay transcript content in any form
- Transcripts exist only as local files on disk

Privacy mode is designed for legal, medical, financial, and corporate deployments where transcript content must not leave the local environment under any circumstances.

### Enabling globally (env var)

Set in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin",
        "WHISPER_PRIVACY_MODE": "true"
      }
    }
  }
}
```

Requires a Claude Desktop restart to take effect.

### Enabling per-call (no restart required)

Pass `privacy_mode=true` directly to any transcription tool:

- *"Transcribe this file in privacy mode"*
- *"Start a batch on this folder, privacy_mode=true"*
- *"Check progress on job_123, privacy_mode=true"*

The per-call parameter overrides the global env var in either direction. Pass `privacy_mode=false` to disable for a single call even when `WHISPER_PRIVACY_MODE=true` globally.

### Privacy mode gate behavior

When privacy mode is active, a confirmation disclosure is shown **before every operation**. This is intentional — regulatory compliance requires informed consent before each processing event, not just once per session.

The disclosure text is identical every time by design. The repetition is the point: if you are handling sensitive content, you should be confirming each operation explicitly.

For `start_batch` with privacy mode: one confirmation is required before the batch starts. All files then process unattended. No transcript text is returned at any point — only batch progress metadata.

---

## Consent Gate (standard mode)

When privacy mode is not active, a one-time session disclosure is shown before any transcript text is returned to Claude's API for the first time in a session.

The disclosure covers:
- That transcript text will be transmitted to Anthropic's API
- The regulatory frameworks that may apply to your content
- How to enable privacy mode if needed
- How to suppress the gate permanently for non-sensitive content

After you confirm, the gate does not fire again for the rest of the session. Claude Desktop restart resets the session and the gate fires again on the next transcript-returning call.

**For background jobs:** the consent gate fires at `check_progress` completion, not at `transcribe_audio` call time. At call time, no transcript text exists yet — there is nothing to gate. The gate fires the moment transcript text would first be returned to the API.

### Skipping the gate permanently

If you regularly transcribe non-sensitive content and no longer need the reminder, set in your config:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

This has no effect when privacy mode is active. Privacy mode uses its own per-operation gate that always fires regardless of this setting.

---

## Data flow summary

| Mode | Audio | Transcript text | Confirmation required |
|---|---|---|---|
| Standard | Local only | Sent to Anthropic API | Once per session (consent gate) |
| Privacy mode (env var) | Local only | Never transmitted | Before every operation |
| Privacy mode (per-call) | Local only | Never for this call | Before this operation |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Local only | Sent to Anthropic API | Never (skipped) |

---

## Uploading transcript files directly to Claude

When you upload a `.txt` transcript file directly to Claude as a file attachment — outside the MCP tool entirely — the MCP server has no visibility and cannot apply any privacy controls.

Uploading a transcript directly to Claude is equivalent to sending the audio content to Anthropic. Privacy mode and all MCP-level protections are bypassed entirely by direct file uploads.

Users handling regulated content must not upload transcripts directly to Claude. The only safe analysis path for regulated content is local processing tools that do not transmit content externally.

---

## Regulated industry guidance

The following is general information only. The authors of this tool are not lawyers. Users bear sole responsibility for compliance with applicable laws and regulations. When in doubt, consult qualified legal counsel before transcribing regulated content.

### HIPAA (USA — healthcare)
Medical providers, insurers, and their business associates are prohibited from transmitting Protected Health Information (PHI) to unauthorized third parties without a Business Associate Agreement (BAA). Anthropic does not offer a HIPAA BAA for Claude consumer API usage.

**Affected use cases:** Patient consultations, clinical notes, therapy sessions, insurance claim calls, hospital administrative recordings.

**Recommendation:** Enable `WHISPER_PRIVACY_MODE=true` before transcribing any patient audio. Do not disable it mid-session.

### GDPR (EU/EEA)
Personal data of EU residents cannot be transferred to third-party processors without explicit consent and a lawful basis for processing. Transcript text containing names, locations, or any identifying information constitutes personal data under GDPR.

**Affected use cases:** Interviews, meetings, call center recordings, court proceedings involving EU residents.

**Recommendation:** Enable privacy mode for any recording that may contain personal data of EU/EEA residents.

### Attorney-Client Privilege (USA, UK, AU, and most common law jurisdictions)
Communications between attorneys and clients are legally privileged. Disclosure to unauthorized third parties may waive privilege. There is no established legal precedent protecting attorney-client communications when processed by commercial AI APIs.

**Affected use cases:** Legal depositions, client consultations, internal strategy recordings, witness interviews.

**Recommendation:** Attorneys transcribing privileged communications should enable privacy mode. Do not disable it for analysis — use local text editors or processing tools for privileged content.

### FERPA (USA — education)
Educational records of students are protected. Schools and universities cannot disclose identifiable student information to third parties without consent.

**Affected use cases:** Recorded lectures, student counseling sessions, academic hearings, IEP meetings.

### SOX (USA — publicly traded companies)
Financial communications of public companies are subject to record-keeping and confidentiality requirements. Material non-public information (MNPI) cannot be selectively disclosed.

**Affected use cases:** Earnings call recordings, board meeting transcripts, investor communications, internal financial strategy discussions.

### PCI-DSS
Payment card data cannot be stored or transmitted in unsecured environments. Voice recordings of card numbers during transactions are in scope.

**Affected use cases:** Call center recordings, customer service calls involving payment processing.

### Trade Secret / NDA Protections
Confidential business information, proprietary formulas, unreleased product details, and personnel information may be protected by contract or law.

**Affected use cases:** Corporate strategy meetings, R&D discussions, M&A due diligence calls, HR proceedings.

---

## Reporting privacy concerns

If you identify a privacy issue or an architectural gap not covered here, please use GitHub's private vulnerability reporting rather than opening a public issue. See [SECURITY.md](SECURITY.md) for reporting instructions.
