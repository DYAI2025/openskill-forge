# ⚒️ Skill Forge

**AI Skill Generator** — Create fully functional AI agent skills from goals & reference documents.

A standalone web service that generates production-ready SKILL.md files in the standard format used by OpenClaw, Claude, GPT, and other AI agent platforms.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Goal-to-Skill**: Describe what you want → get a complete SKILL.md
- **Document-Aware**: Upload reference docs (md, txt, json, pdf, xml, yaml, docx) to inform generation
- **Auto-Validation**: Quality scoring with P0/P1/P2 issue detection
- **Auto-Refinement**: Automatically fixes P0 issues when using API mode
- **Dual Mode**: Works with LLM APIs (OpenAI/Anthropic/Ollama) or locally (no API key needed)
- **Embeddable**: Drop into any website with one script tag
- **Modern UI**: Minimalist dark-mode interface, fully responsive

## Quick Start

```bash
# Clone & install
cd Projects/skill-forge
npm install

# Configure (optional — works without API key in local mode)
cp .env.example .env
# Edit .env with your API key

# Development
npm run dev

# Production
npm run build
npm start
```

Open http://localhost:3001

## API

### `POST /api/generate`
Generate a new skill. Multipart form data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `goal` | string | ✓ | What the skill should do |
| `definitionOfDone` | string | | Success criteria |
| `files` | file[] | | Reference documents (max 10) |
| `options` | JSON string | | `{ skillName, language, additionalConstraints, useLocal }` |

### `POST /api/refine`
Refine an existing skill.

```json
{ "sessionId": "...", "skill": "...", "feedback": "Make workflow more detailed" }
```

### `POST /api/validate`
Validate a skill without generating.

```json
{ "skill": "---\nname: ...\n---\n..." }
```

### `GET /api/health`
Health check.

## Embedding

Add Skill Forge to any website:

```html
<div id="skill-forge"></div>
<script src="https://your-skill-forge-url/embed.js" data-target="skill-forge"></script>
```

## Supported Document Types

| Extension | Parser |
|-----------|--------|
| `.md`, `.txt` | Plain text |
| `.json` | JSON (pretty-printed) |
| `.yaml`, `.yml` | YAML |
| `.xml` | XML → JSON |
| `.pdf` | PDF text extraction |
| `.docx` | Word document text extraction |

## Output Format

Generated skills follow the standard SKILL.md format:

```markdown
---
name: skill-name
description: One-line description
---

## When to Use / Wann verwenden
## Inputs / Eingaben  
## Workflow / Instructions / Anweisungen
## Output Format / Ausgabeformat
## Examples / Beispiele
```

## LLM Providers

| Provider | Env Var | Model Default |
|----------|---------|---------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Ollama | `OLLAMA_BASE_URL` | `llama3` |

Set `LLM_PROVIDER` in `.env` to switch. Falls back to local generation if no API key is set.

## Architecture

```
skill-forge/
├── server/
│   ├── index.js           # Express API server
│   ├── parsers.js          # Document parsers (md/pdf/docx/xml/yaml/json)
│   ├── prompt-engine.js    # Prompt construction from kit mechanics
│   ├── llm-client.js       # Multi-provider LLM client
│   └── local-generator.js  # Template-based local generation (no API)
├── src/
│   ├── main.js            # Frontend SPA (vanilla JS)
│   └── styles.css         # Design system
├── public/
│   └── embed.js           # Embeddable widget script
├── dist/                  # Built frontend (after npm run build)
└── .env                   # Configuration
```

## Based On

Built from the **OpenClaw Skill Creator Kit** mechanics — a meta-system for reverse-engineering and generating AI agent skills with:
- Groundedness-only generation (no hallucination)
- SOURCE anchoring protocol
- P0/P1/P2 quality rules
- Conflict logging and resolution
