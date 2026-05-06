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
| Transcript `.txt` / `.srt` files on disk | ❌ Never |

---

## What data may leave your machine (default behavior)

When a tool response includes transcript text, that text is returned to Claude Desktop and processed by Anthropic's API. This is standard MCP behavior — the text travels from the local MCP server to Claude's model over the network.

| Data | Leaves machine? |
|---|---|
| Transcript text returned inline in tool responses | ✅ Yes, by default |
| Transcript text uploaded directly to Claude as a file | ✅ Yes (outside MCP entirely) |

This gap exists between the tool's "no data leaves your machine" guarantee and the actual behavior when you ask Claude to read, summarize, or analyze a transcript. Most users — those transcribing public content like YouTube videos, podcasts, or streaming recordings — are unaffected by this distinction.

For users handling private, confidential, or regulated recordings, this distinction matters.

---

## Privacy Mode (planned — not yet implemented)

A `WHISPER_PRIVACY_MODE` environment variable is planned for a future release. When enabled:

- All tool responses return only metadata: filename, duration, word count, completion status
- No transcript text is included in any tool response
- Claude cannot read, analyze, or relay transcript content in any form
- Transcripts exist only as local `.txt` files on disk

This mode is designed for legal, medical, financial, and corporate deployments where transcript content must not leave the local environment under any circumstances.

**Planned configuration:**

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

Until this feature ships: if you need to analyze transcript content without transmitting it to Claude's API, open the `.txt` file directly in a local text editor or processing tool.

---

## Regulated industry guidance

The following is general information only. The authors of this tool are not lawyers. Users bear sole responsibility for compliance with applicable laws and regulations. When in doubt, consult qualified legal counsel before transcribing regulated content.

### HIPAA (USA — healthcare)
Medical providers, insurers, and their business associates are prohibited from transmitting Protected Health Information (PHI) to unauthorized third parties without a Business Associate Agreement (BAA). Anthropic does not offer a HIPAA BAA for Claude consumer API usage.

**Affected use cases:** Patient consultations, clinical notes, therapy sessions, insurance claim calls, hospital administrative recordings.

**Current recommendation:** Do not transcribe patient audio and then ask Claude to summarize or analyze the transcript unless your organization has established a compliant processing arrangement. Use `WHISPER_PRIVACY_MODE` when it becomes available.

### GDPR (EU/EEA)
Personal data of EU residents cannot be transferred to third-party processors without explicit consent and a lawful basis for processing. Transcript text containing names, locations, or any identifying information constitutes personal data under GDPR.

**Affected use cases:** Interviews, meetings, call center recordings, court proceedings involving EU residents.

**Current recommendation:** Be aware that uploading transcripts containing EU resident personal data to Claude may have GDPR implications depending on your role and processing purpose.

### Attorney-Client Privilege (USA, UK, AU, and most common law jurisdictions)
Communications between attorneys and clients are legally privileged. Disclosure to unauthorized third parties may waive privilege. There is no established legal precedent protecting attorney-client communications when processed by commercial AI APIs.

**Affected use cases:** Legal depositions, client consultations, internal strategy recordings, witness interviews.

**Current recommendation:** Attorneys transcribing privileged communications should not upload those transcripts to Claude for analysis without independent legal review of the privilege implications.

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

## Uploading transcript files directly to Claude

When you upload a `.txt` transcript file directly to Claude as a file attachment — outside the MCP tool entirely — the MCP server has no visibility and cannot apply any privacy controls.

Uploading a transcript directly to Claude is equivalent to sending the audio content to Anthropic. No privacy mode or future MCP-level protection will apply to direct file uploads.

Users handling regulated content must not upload transcripts directly to Claude. The only safe analysis path for regulated content is local processing tools that do not transmit content externally.

---

## Reporting privacy concerns

If you identify a privacy issue or an architectural gap not covered here, please use GitHub's private vulnerability reporting rather than opening a public issue. See [SECURITY.md](SECURITY.md) for reporting instructions.
