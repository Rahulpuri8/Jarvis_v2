# BuildOS AI (Jarvis V1) - User & Automated Testing Guide

This document provides complete instructions for human users, automated agents (such as Codex), and CI pipelines to test the **BuildOS AI (Jarvis V1)** desktop workspace.

---

## 1. Headful Interactive Visual Testing (See Everything Live)

To test the application **headfully** (with a full visible desktop GUI window and detached Chrome DevTools to inspect real-time IPC calls, React state, and active agents):

*(Note: Ollama is detected locally with `qwen2.5-coder:7b`, `qwen2.5:3b`, and `moondream:latest` already installed)*

### Launch in Headful Mode with DevTools
```bash
npm run dev
```

### What happens in Headful Mode:
1. **Desktop Window Appears**: A visible `1600x960` desktop window opens on your screen.
2. **Detached DevTools Opens**: Chrome DevTools opens automatically alongside the app.
3. **Console & IPC Monitor**: You can switch to the DevTools **Console** or **Network** tab to watch IPC messages, agent model calls, and SQLite database queries live.

---

### Headful Visual Test Checklist (Watch What Works Live):

| Feature | Action to Take | Visual Result to Verify |
| :--- | :--- | :--- |
| **1. Workspace Boundary** | Click **Select Folder** $\rightarrow$ Choose `demo-workspace` | File tree populates live; parent directory paths are inaccessible. |
| **2. Provider Status** | Go to **Settings** $\rightarrow$ Set Provider Mode to `Local` / `Ollama` | App updates provider status pill to **Ollama (qwen2.5:3b)**. |
| **3. Live Agent Planning** | In Chat, type: *"Create a PRD for a Weather CLI"* | Requirement agent streams text and populates the **Documents** tab. |
| **4. Visual Approval Queue** | Type: *"Create an `app.js` file with Express setup"* | A yellow **Pending Proposal** card pops up in the **Approval Queue**. |
| **5. File Diff Viewer** | Click **View Diff** on the file proposal | Displays side-by-side proposed additions before writing to disk. |
| **6. Command Risk & Terminal** | Type: *"Run `npm install express`"* | Command is rated (`LOW`/`MED`), requires explicit click on **Approve & Run**. |
| **7. Audit Log Stream** | Open **Action Log** tab | Displays live chronological log of all completed file writes & commands. |

---

## 2. Fast Automated Headless Smoke Test (For CI / Background Agents)

If Codex or an automated AI agent needs to evaluate the system programmatically without launching a GUI window:

### Step 1: Rebuild Native Modules & Compile TypeScript
```bash
npm run electron:rebuild --workspace @buildos/desktop
npm run build
```

### Step 2: Run the End-to-End Headless Smoke Script
```bash
npx electron scripts/manual-smoke.electron.cjs
```

### What this script validates automatically:
- Creates a sandboxed demo project workspace in `demo-workspace/smoke-email-assistant`
- Runs SQLite database migrations
- Simulates requirement gathering & orchestrator decisions
- Generates PRD, Tech Stack, Architecture, API Plan, and Database Schema documents
- Generates file write proposals for starter code
- Applies approved file writes safely to disk
- Verifies sensitive path security (verifying `.env` is blocked from unauthorized reads)
- Tests command risk classification and approved execution
- Stores audit history in SQLite

---

## 2. Unit & Integration Test Suite

Run the Vitest suite across all service & agent modules:

```bash
# Run tests for path safety, model router, security, and agents
npx vitest run
```

### Key Test File Locations
- `apps/desktop/tests/security.service.test.ts`: Validates path traversal prevention and protected file filtering.
- `apps/desktop/tests/approval.service.test.ts`: Validates approval queue & action history.
- `apps/desktop/tests/model-router.test.ts`: Validates provider routing logic (Gemini / Groq / Ollama).
- `apps/desktop/tests/orchestrator.agent.test.ts`: Validates agent orchestration routing.

---

## 3. Manual Desktop GUI User Test Plan

To test the application interactively as an end user:

### Step 1: Start the Desktop App in Dev Mode
```bash
npm run dev
```

### Step 3: Execute User Acceptance Scenarios

#### Scenario A: Workspace Boundary Setup
1. On startup, click **Select Folder**.
2. Pick any local directory (e.g. `demo-workspace`).
3. **Pass Criteria**: File tree populates on the left sidebar. Files outside this directory cannot be accessed.

#### Scenario B: Provider Setup (Ollama / Local LLM)
1. Navigate to **Settings** in the application menu.
2. Set **Provider Mode** to `Local` (or select `Ollama`).
3. Ensure **Base URL** is `http://localhost:11434` and **Model** is `qwen2.5:3b`.
4. Save settings.

#### Scenario C: Requirement & Planning Workflow
1. Open the **Chat** panel.
2. Enter: *"Plan a NodeJS REST API for managing tasks with SQLite."*
3. **Pass Criteria**: The AI requirement agent responds with clarifying questions or generates a PRD & Task Breakdown in the **Documents** tab.

#### Scenario D: Approval-Gated File Operations
1. In chat, type: *"Create an `app.js` file with basic Express setup."*
2. **Pass Criteria**: The file is NOT written directly. An entry appears in **Approval Queue**.
3. Inspect the code diff in the Approval Queue, then click **Approve**.
4. Check your project folder; `app.js` now exists.

#### Scenario E: Command Risk & Execution Approval
1. In chat, ask: *"Run `npm install express`."*
2. **Pass Criteria**: The system flags the command with a risk rating (`LOW`/`MEDIUM`) and asks for user confirmation before running it in the background terminal.

---

## 4. Test Environment Verification Matrix

| Test Layer | Command | Primary Purpose |
| :--- | :--- | :--- |
| **Headless E2E Smoke** | `node scripts/manual-smoke.electron.cjs` | Validates complete lifecycle in headless node environment |
| **Unit & Integration** | `npx vitest run` | Validates isolated component logic & safety functions |
| **Production Build** | `npm run build` | Validates React & TypeScript bundle compilation |
| **Interactive GUI** | `npm run dev` | Full desktop electron user experience test |
