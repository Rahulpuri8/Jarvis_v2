# BuildOS AI (J.A.R.V.I.S)

Local-first AI desktop workspace for project planning, PRDs, architecture, task breakdowns, and approval-gated file or command actions.

> 📖 **Developer Guide & Project Overview**: For complete architectural details, implemented features, safety tiers, and developer onboarding instructions, see **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**.

## Problem

Starting a software project usually requires switching between notes, architecture docs, task boards, terminals, code editors, and AI chat tools. This slows down builders and makes it easy to lose project context.

AI coding tools can also feel risky when they read files, write files, or run commands without clear boundaries.

## Solution

BuildOS AI is an Electron desktop app that works inside one selected local project folder. It helps users clarify requirements, generate planning documents, create task breakdowns, inspect files safely, and propose local file or command actions through an approval workflow.

The goal is to act like a practical AI tech lead for early project planning while keeping local file access and command execution controlled.

## Features

- Create and reopen local project workspaces
- Select one local folder as the project boundary
- Browse project files safely
- Block protected files such as `.env`, private keys, and credentials files
- Prevent path traversal outside the selected project folder
- Chat with an AI planning workflow
- Generate requirements questions
- Generate PRDs, architecture notes, API plans, database schema notes, roadmaps, and task breakdowns
- Route AI calls through Gemini, Groq, or Ollama
- Switch between cloud and local provider modes
- Store project memory locally in SQLite
- Propose file writes before applying them
- Propose commands before running them
- Classify command risk levels
- Keep an action log of project activity
- Configure provider keys and safety settings from the desktop app

### Browser agent demo

In the Electron desktop window, ask a browser-specific question such as
“Open https://example.com in the browser and tell me what the page says.”
The local `qwen2.5-coder:7b` model can search, open, inspect, read, and scroll pages
through the Python Playwright runtime. After each tool result, an Electron main
process coordinator asks the model what to do next, up to eight actions. Clicks
and form typing pause in the existing Security Gate; approving resumes the
stored action and the browser task. A rejection stops the task.

The browser is a separate, visible Playwright session. Sign in manually if a
site requires it. The session is currently ephemeral; it does not reuse your
normal Chrome profile or survive an app restart. This is a bounded demo agent,
not unattended cross-site automation. The localhost Python runtime still needs
authentication and stronger server-side authorization before it can be treated
as a secure boundary against other local processes. Browser-only tasks run in
the Electron desktop window; the Vite browser preview retains its earlier chat
path.

Set up the Python dependencies in `runtime/requirements.txt`, install Playwright's
Chromium browser with `python -m playwright install chromium`, and have Ollama
running with `qwen2.5-coder:7b`. The Electron app starts the Python sidecar.

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- SQLite
- better-sqlite3
- Vitest
- Gemini API
- Groq API
- Ollama

## Architecture

User -> React Renderer -> Electron IPC -> Main Process Services -> SQLite / File System / AI Providers -> Response

Main parts:

- `apps/desktop/renderer`: React UI
- `apps/desktop/electron`: Electron main process, IPC handlers, services, SQLite migrations
- `packages/ai`: AI provider interface, Gemini/Groq/Ollama providers, model router
- `packages/agents`: planning agents for orchestration, requirements, PRD, architecture, tech stack, and tasks
- `packages/shared`: shared types, schemas, constants, and safety rules

## Security Model

BuildOS AI is designed around explicit local boundaries:

- The app works inside one selected project folder.
- File paths are resolved and checked before access.
- Sensitive files are blocked unless explicitly allowed by policy.
- File writes are proposed before being applied.
- Commands are classified by risk before execution.
- Commands and file changes are stored as approval records.
- Renderer code does not directly access Node file system APIs.

## Screenshots

Screenshots will be added soon.

Suggested screenshots:

- Home screen
- Workspace screen
- File tree and document panel
- Approval queue
- Settings page
- Generated PRD or architecture document

## How to Run

### Prerequisites

- Node.js 20 LTS or newer
- npm
- Windows, macOS, or Linux desktop environment
- Optional: Ollama for local model mode

### Setup

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Fill in only the providers you want to use.

Run the desktop app:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_AI_PROVIDER=gemini
DEFAULT_LOCAL_MODEL=qwen2.5-coder:7b
```

Do not commit real `.env` files or API keys.

## Testing

The project includes Vitest tests for:

- Path safety
- Protected file detection
- Command risk classification
- File system service behavior
- Model router behavior
- Approval service behavior
- Project service behavior
- Settings persistence

Note: `better-sqlite3` uses native bindings. If tests fail during setup, check that your Node version and native build tools are compatible.

## Current Limitations

- No full computer control
- No browser automation
- No automatic deployment
- No real external email or calendar integration
- No multi-user SaaS support
- No RAG or vector database workflow yet
- API keys are stored locally in SQLite in this V1 prototype

## Future Improvements

- Add screenshots and demo GIF
- Add GitHub Actions CI
- Add packaged desktop releases
- Add stronger JSON parsing and retry logic for LLM responses
- Add streaming AI responses
- Add encrypted local secret storage
- Add diff viewer for file changes
- Add model health checks
- Add RAG over selected project files
- Add optional Git-aware workflows
- Add project templates for FastAPI, Flask, Streamlit, and full-stack apps
