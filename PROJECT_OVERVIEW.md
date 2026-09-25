# J.A.R.V.I.S / BuildOS AI — Project Overview & Developer Guide

Welcome to **J.A.R.V.I.S (BuildOS AI)**! This comprehensive guide is designed for new developers, collaborators, and AI coding assistants joining the project. It explains the system's architecture, what has been implemented, how the components work together, the technical stack, safety tiers, and how to run, develop, and test the project.

---

## Table of Contents

1. [Executive Summary & Vision](#1-executive-summary--vision)
2. [What Has Been Implemented & Completed](#2-what-has-been-implemented--completed)
3. [Technology Stack](#3-technology-stack)
4. [Architecture & System Design](#4-architecture--system-design)
5. [Safety Tiers & Guardrails](#5-safety-tiers--guardrails)
6. [Interactive HUD & Voice Capabilities](#6-interactive-hud--voice-capabilities)
7. [Task Interruption & Context Management](#7-task-interruption--context-management)
8. [Directory Structure](#8-directory-structure)
9. [Developer Setup & How to Run](#9-developer-setup--how-to-run)
10. [Testing & QA Protocols](#10-testing--qa-protocols)
11. [Current Roadmap & Next Steps](#11-current-roadmap--next-steps)

---

## 1. Executive Summary & Vision

**J.A.R.V.I.S BuildOS** is a local-first, Iron Man-inspired AI operating layer and desktop assistant running directly on the host computer. Unlike browser-only chatbots or headless scripts, J.A.R.V.I.S bridges:

* **Local LLM Intelligence**: Powered by Ollama (`qwen2.5-coder:7b`, `qwen2.5:3b`, `moondream:latest`).
* **Desktop & System Automation**: Python Tool Gateway (78+ host tools covering system telemetry, disk partitions, app launching/closing, and live web queries).
* **Cyberpunk Iron Man Arc Reactor HUD**: Animated reactor cores, live frequency waves, audio feedback synthesis, holographic panels, and dark-mode aesthetics.
* **Rigorous Safety Governance**: Structured, multi-tier approvals that prevent accidental file deletion, unwanted reboots, or unauthorized software execution.

---

## 2. What Has Been Implemented & Completed

### Core Functionality
* **Tool-Calling Engine**: Dynamic tool registry (`tool-registry.ts`) that self-declares safety tiers and translates user intents to structured function calls without brittle keyword regexes.
* **Tier-1 Instant Execution**: Allowlisted desktop apps (`calc.exe`, `notepad.exe`, `explorer.exe`, `ms-settings:`, `chrome.exe`) and safe read-only queries (telemetry, drives, directory listings, Ollama model inspection) bypass approval gates and execute immediately.
* **Tier-2 Destructive Action Guard**: Sensitive operations (`system_shutdown`, `system_restart`, `files_delete`) force the orchestrator into an `AWAITING_CONFIRMATION` state. J.A.R.V.I.S asks for explicit voice or text confirmation before execution.
* **Security & Approval Gate**: Any non-allowlisted application launch or high-risk shell command generates a structured approval proposal in the UI with Accept/Reject actions.
* **Task Interruption & Abort Handling**: If the user submits a new task while a previous task is running, J.A.R.V.I.S intelligently asks whether to switch or finish the current task. In-flight Ollama network requests are aborted cleanly using `AbortController`.
* **Visual Processing & Thinking Effects**: Glowing Arc Reactor pulse animations and sliding gradient progress bars in both the Chat Panel (`ChatPanel.tsx`) and the central Arc HUD (`ArcHudScreen.tsx`).
* **Host Hardware Telemetry & RAM Guard**: Continuous monitoring of CPU load, memory usage, dedicated GPU metrics (VRAM, load, temperature), and NVMe drive partitions with automatic model throttling recommendations above 85% RAM usage.
* **Live Ollama Health & Model Inspection**: `system_ollama_status` tool queries the local Ollama daemon (`http://127.0.0.1:11434/api/tags`) and reports loaded models, parameters, and active inference ports.
* **Speech Synthesis & Speech Recognition**: Web Speech API integration with natural voice feedback, automatic silence detection (1.2s auto-execute), and push-to-talk Arc Reactor button.

---

## 3. Technology Stack

### Frontend & Desktop GUI (`apps/desktop/renderer`)
* **Framework**: React 19, TypeScript 5.8
* **Build System**: Vite 6, Tailwind CSS 4
* **State Management**: Custom React hooks (`useBuildOS`), Zustand
* **Icons & Typography**: Google Fonts (`Orbitron`, `Rajdhani`, `Share Tech Mono`), custom SVG HUD elements
* **Markdown Rendering**: `react-markdown` with syntax highlighting

### Electron Main Process & Services (`apps/desktop/electron`)
* **Shell**: Electron 35
* **Local Database**: SQLite with `better-sqlite3` (migrated schema for messages, projects, tasks, approval logs)
* **Resource Monitoring**: Centralized RAM monitor with hysteresis (`resource-monitor.ts`)
* **IPC Bridge**: Strongly typed IPC channels (`ipc.ts`)

### Local AI & Sidecar Services (`runtime/` & External Daemons)
* **LLM Engine**: Ollama daemon (`http://127.0.0.1:11434`) running `qwen2.5-coder:7b` (default)
* **Python Runtime Sidecar**: FastAPI / Uvicorn server running on `http://127.0.0.1:9321` (`runtime/main.py`)
  * 78 registered tools: desktop control, process management, file inspection, live web search, system telemetry
  * Libraries: `psutil`, `pyautogui`, `uvicorn`, `fastapi`

---

## 4. Architecture & System Design

```
+-------------------------------------------------------------------------+
|                           User Interface                                |
|        React 19 + Vite Renderer (ARC HUD / Assistant Console)           |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                         useBuildOS Hook                                 |
|             (Task Interruption, AbortController, State)                 |
+-------------------+--------------------+--------------------+-------+
                    |                    |                    |
                    v                    v                    v
         +--------------------+ +------------------+ +------------------+
         | ConversationMgr    | | ToolRegistry     | | ExecutionEngine  |
         | Sliding window     | | Safety schemas   | | Tier routing &   |
         | Summary context    | | Allowlisted apps | | Sidecar dispatch |
         +--------------------+ +------------------+ +--------+---------+
                                                              |
                               +------------------------------+
                               |
                               v
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  Local Ollama Daemon  |             | Python Tool Runtime   |
|  Port 11434 (LLM API) |             | Port 9321 (FastAPI)   |
+-----------------------+             +-----------------------+
                                                  |
                                                  v
                                      +-----------------------+
                                      | Windows Host OS       |
                                      | (Apps, Shell, HW Info)|
                                      +-----------------------+
```

---

## 5. Safety Tiers & Guardrails

| Safety Tier | Criteria | Example Operations | Execution Flow |
| :--- | :--- | :--- | :--- |
| **Tier-1 (Instant)** | Safe, read-only, or allowlisted utilities | `calc.exe`, `notepad.exe`, `explorer.exe`, `ms-settings:`, `chrome.exe`, `system_get_telemetry`, `system_list_drives`, `system_ollama_status` | Executes immediately; no approval modal required. |
| **Tier-2 (Awaiting Confirmation)** | Irreversible, destructive actions | `system_shutdown`, `system_restart`, `files_delete` | Sets state to `AWAITING_CONFIRMATION`. Asks for vocal/text confirmation (`yes`/`no`). |
| **Normal (Approval Gate)** | External software launches, shell scripts | `spotify`, `vlc`, custom `.exe` files, terminal shell execution | Places a proposal card into the **Security Gate** panel awaiting operator authorization. |

---

## 6. Interactive HUD & Voice Capabilities

The UI includes two primary views:
1. **ARC HUD Screen (`ArcHudScreen.tsx`)**:
   * Center interactive Arc Reactor push-to-talk button.
   * Floating holographic windows: **Operations & Task Pipeline**, **Hardware Telemetry Gauges**, **Security Gate**, and **Holographic Terminal**.
   * Real-time acoustic frequency waves reflecting speech input and audio synthesis.
   * Tactical Intel Stream displaying formatted results and context navigation shortcuts.
2. **Assistant Console (`ChatPanel.tsx`)**:
   * Conventional chat feed with speech feedback integration.
   * Direct in-chat authorization banners for pending security proposals.
   * Quick-launch prompt presets (e.g., *"Check Ollama status and loaded models"*).

---

## 7. Task Interruption & Context Management

* **Sliding Context Window**: Managed by `ConversationManager`. Retains the 10 most recent exchanges with background summary compression when message history exceeds 2x the threshold.
* **Task Conflict Handler**:
  * Prevents concurrent contradictory tool runs.
  * When a command is issued mid-process, J.A.R.V.I.S asks:
    > *"Sir, I'm currently working on '[Task A]'. Would you like me to switch to your new request, or finish the current task first?"*
  * Responding `"switch"` aborts the prior request immediately via `AbortController` and starts the new request.
  * Responding `"finish"` or `"keep"` allows the current task to conclude.

---

## 8. Directory Structure

```
Jarvis_V1/
├── apps/
│   └── desktop/
│       ├── electron/                  # Electron main process
│       │   ├── main.ts                # Application lifecycle & window creation
│       │   ├── ipc.ts                 # Strongly-typed IPC handlers
│       │   └── services/              # Desktop services
│       │       ├── command-runner.service.ts
│       │       ├── resource-monitor.service.ts
│       │       └── workflow-engine.service.ts
│       ├── renderer/                  # React 19 application
│       │   ├── src/
│       │   │   ├── components/        # HUD, Chat, Panels, Layout
│       │   │   ├── hooks/useBuildOS.ts# Primary state glue & interruption logic
│       │   │   ├── pages/             # HomePage, WorkspacePage, SettingsPage
│       │   │   ├── services/          # ToolRegistry, ConversationManager, ExecutionEngine
│       │   │   └── utils/             # Speech synthesis & audio helpers
│       │   └── vite.config.ts         # Vite build configuration
│       └── package.json
├── packages/
│   ├── ai/                            # Multi-provider LLM adapters (Ollama, Groq, Gemini)
│   ├── agents/                        # Planning & code generation agent definitions
│   └── shared/                        # TypeScript schemas, models, and types
├── runtime/                           # Python FastAPI Tool Execution Sidecar (Port 9321)
│   ├── main.py                        # FastAPI server & WebSocket endpoint
│   ├── core/                          # Gateway, models, and registry
│   └── tools/                         # Desktop, system, files, browser, voice tools
├── scratch/                           # Diagnostic test scripts & QA runners
├── screenshots/                       # Visual QA screenshots and captures
└── README.md                          # Repository root documentation
```

---

## 9. Developer Setup & How to Run

### Prerequisites
* **Node.js**: v20+ LTS
* **Python**: v3.10+ (with `pip`)
* **Ollama**: Installed and running locally (`ollama serve`)
  * Recommended model: `ollama pull qwen2.5-coder:7b`

### Step 1: Install Dependencies
```bash
# In the repository root
npm install
```

### Step 2: Start the Python Tool Runtime Sidecar
```bash
# In a dedicated terminal:
cd runtime
python -m uvicorn runtime.main:app --host 127.0.0.1 --port 9321
```
*Verify sidecar health*: `curl http://127.0.0.1:9321/health` (should return healthy with 78 tools).

### Step 3: Launch the Desktop App in Development Mode
```bash
# In your main terminal:
npm run dev
```
* This boots the Vite development server at `http://localhost:5173/` and launches Electron with Chrome DevTools open.

---

## 10. Testing & QA Protocols

### TypeScript & Production Build Verification
```bash
cd apps/desktop
npm run build
```

### Running Automated QA Passes
Diagnostic scripts are located in `scratch/`:
* `scratch/test_chat.js`: CLI validation of Ollama tool calls.
* `scratch/voice_qa_full_suite.cjs`: Comprehensive Puppeteer test simulating voice queries across all safety tiers.
* `scratch/capture_all_screens.cjs`: Full-resolution screenshot generator capturing all tabs into `screenshots/`.

---

## 11. Current Roadmap & Next Steps

1. **Continuous Voice Streaming**: Upgrading the Web Speech API with real-time offline Whisper / Vosk STT for fully disconnected voice control.
2. **Autonomous Multi-Step Workflows**: Enhancing multi-step goal execution where J.A.R.V.I.S runs chained terminal and file operations autonomously.
3. **Hardware Accelerators**: Fine-tuning GPU memory offloading for systems with constrained VRAM.
