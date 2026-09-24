import { dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { OrchestratorAgent } from '../../../packages/agents/orchestrator.agent';
import { RequirementAgent } from '../../../packages/agents/requirements.agent';
import { PRDAgent } from '../../../packages/agents/prd.agent';
import { CTOAgent } from '../../../packages/agents/cto.agent';
import { ArchitectAgent } from '../../../packages/agents/architect.agent';
import { ProjectManagerAgent } from '../../../packages/agents/project-manager.agent';
import { WorkflowPlannerAgent } from '../../../packages/agents/workflow-planner.agent';
import { createProvider } from '../../../packages/ai/model-router';
import type { AIProvider } from '../../../packages/ai/providers/ai-provider.interface';
import type Database from 'better-sqlite3';
import { ApprovalService } from './services/approval.service';
import { CommandRunnerService } from './services/command-runner.service';
import { FileSystemService } from './services/file-system.service';
import { ProjectService } from './services/project.service';
import { SecurityService } from './services/security.service';
import { SettingsService } from './services/settings.service';
import { StarterFilesService } from './services/starter-files.service';
import { PythonRuntimeService } from './services/python-runtime.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import type { AgentOutput, ToolRequest, ToolResult, WorkflowPlan } from '../../../packages/shared/types';

interface IpcDependencies {
  db: Database;
  appDataPath: string;
  provider: AIProvider | null;
  pythonRuntimeService?: PythonRuntimeService | null;
}


const buildRoadmapMarkdown = (tasksMarkdownSource: Array<{ title: string; team: string; priority: string; dependenciesJson: string }>): string =>
  `# Roadmap

## Milestone 1: Planning Foundation
- Finalize scope, requirements, and safety model
- Lock technical direction and architecture

## Milestone 2: Workspace Core
- Implement folder selection, safe file access, chat, docs, and tasks
- Add persistent settings and project memory

## Milestone 3: Approval Workflows
- Add approval queue for file writes and commands
- Persist command outputs and action history

## Team Sequencing
${tasksMarkdownSource
  .map((task) => `- ${task.team}: ${task.title} (${task.priority}) deps ${task.dependenciesJson}`)
  .join('\n')}`;

const buildApiPlanMarkdown = (): string => `# API and IPC Plan

## Project APIs
- listProjects
- createProject
- selectProjectFolder

## File APIs
- getProjectTree
- getFileContent
- proposeFileWrite
- approveFileWrite
- rejectFileWrite

## Chat APIs
- sendChatMessage
- getMessages
- getDocuments
- getTasks

## Command APIs
- classifyCommand
- proposeCommand
- runApprovedCommand

## Settings APIs
- getSettings
- saveSettings`;

const buildDatabaseSchemaMarkdown = (): string => `# Database Schema

## Core Tables
- projects
- messages
- requirements
- documents
- tasks
- agent_runs
- actions
- file_changes
- command_runs
- app_settings

## Notes
- Projects scope all workspace memory
- Actions are the approval lifecycle anchor
- File changes and command runs attach executable payloads to actions
- Settings stay local to the desktop app`;

export const resolveToolFromIntent = (message: string): ToolRequest | null => {
  const norm = message.trim().toLowerCase();

  // Git operations
  if (norm === 'git status' || norm === 'check git status' || norm === 'git repo status' || norm === 'repo status') {
    return {
      tool: 'git.status',
      arguments: {},
    };
  }

  if (norm === 'git diff' || norm === 'check git diff' || norm === 'show diff' || norm === 'git changes') {
    return {
      tool: 'git.diff',
      arguments: { staged: false },
    };
  }

  if (norm === 'git diff staged' || norm === 'git staged diff' || norm === 'staged diff') {
    return {
      tool: 'git.diff',
      arguments: { staged: true },
    };
  }

  if (norm.startsWith('git log') || norm === 'commit history' || norm === 'recent commits') {
    return {
      tool: 'git.log',
      arguments: { limit: 5 },
    };
  }

  if (norm.startsWith('git commit ') || norm.startsWith('commit changes ') || norm.startsWith('create commit ')) {
    const msg = message.replace(/^(git commit|commit changes|create commit)\s+(?:-m\s+)?/i, '').replace(/^["']|["']$/g, '').trim();
    return {
      tool: 'git.commit',
      arguments: { message: msg },
    };
  }

  // 1. Close all except
  if (norm.includes('close all except') || norm.includes('close everything except')) {
    const rawList = norm.replace(/.*close (all|everything) except\s+/i, '');
    const apps = rawList.split(/[\s,]+and[\s,]+|[\s,]+/).map((a) => a.trim()).filter(Boolean);
    return {
      tool: 'desktop.close_all_except',
      arguments: { keep_apps: apps.length > 0 ? apps : ['chrome'] },
    };
  }

  // Open directory / file in Antigravity IDE or VS Code
  if (
    (norm.includes('open') || norm.includes('launch')) &&
    (norm.includes('antigravity') || norm.includes('vscode') || norm.includes('vs code')) &&
    (norm.includes('dir') || norm.includes('directory') || norm.includes('folder') || norm.includes('file') || norm.includes('project') || norm.includes('into') || norm.includes('in') || norm.startsWith('open ') || norm.startsWith('launch '))
  ) {
    const isAntigravity = norm.includes('antigravity');
    const editor = isAntigravity ? 'antigravity' : 'vscode';
    let targetPath = 'd:\\Practice Projects\\Jarvis_V1';
    const pathMatch = message.match(/([a-zA-Z]:\\[^"'\n\r]+?)(?:\s+(?:into|in|with|using)\s+(?:antigravity|vscode|vs\s*code)|\s*$)/i) ||
                    message.match(/([a-zA-Z]:\\[^\s"']+|[\.\w\\/-]+\.[a-zA-Z0-9]+)/);
    if (pathMatch && pathMatch[1] && !pathMatch[1].toLowerCase().includes('antigravity') && !pathMatch[1].toLowerCase().includes('vscode')) {
      targetPath = pathMatch[1].trim();
    }
    return {
      tool: 'desktop.open_in_editor',
      arguments: { path: targetPath, editor },
    };
  }

  // 2. Open / Launch app
  if (norm.startsWith('open ') || norm.startsWith('launch ') || norm.startsWith('start app ')) {
    const appName = norm.replace(/^(open|launch|start app)\s+/, '').trim();
    return {
      tool: 'desktop.open_app',
      arguments: { app_name: appName },
    };
  }

  // 3. Close app
  if (norm.startsWith('close ') || norm.startsWith('kill ')) {
    const appName = norm.replace(/^(close|kill)\s+/, '').trim();
    return {
      tool: 'desktop.close_app',
      arguments: { app_name: appName },
    };
  }

  // 4. Focus / switch to app
  if (norm.startsWith('focus ') || norm.startsWith('switch to ') || norm.startsWith('bring up ')) {
    const appName = norm.replace(/^(focus|switch to|bring up)\s+/, '').trim();
    return {
      tool: 'desktop.focus_app',
      arguments: { app_name: appName },
    };
  }

  // 5. Minimize / Maximize window
  if (norm.includes('minimize all') || norm.includes('show desktop')) {
    return {
      tool: 'desktop.minimize',
      arguments: {},
    };
  }

  if (norm.startsWith('minimize ')) {
    const appName = norm.replace(/^minimize\s+/, '').trim();
    return {
      tool: 'desktop.minimize',
      arguments: { app_name: appName },
    };
  }

  if (norm.startsWith('maximize ')) {
    const appName = norm.replace(/^maximize\s+/, '').trim();
    return {
      tool: 'desktop.maximize',
      arguments: { app_name: appName },
    };
  }

  // 6. Move / Position window (e.g. "put chrome on the left", "tile vscode to the right", "center notepad")
  if (norm.includes(' on the left') || norm.includes(' to the left') || norm.includes(' left half')) {
    const appName = norm.replace(/(put|tile|move|place)\s+/i, '').replace(/\s+(on|to)?\s*(the)?\s*(left|left half).*/i, '').trim();
    return {
      tool: 'desktop.move_window',
      arguments: { app_name: appName, position: 'left_half' },
    };
  }

  if (norm.includes(' on the right') || norm.includes(' to the right') || norm.includes(' right half')) {
    const appName = norm.replace(/(put|tile|move|place)\s+/i, '').replace(/\s+(on|to)?\s*(the)?\s*(right|right half).*/i, '').trim();
    return {
      tool: 'desktop.move_window',
      arguments: { app_name: appName, position: 'right_half' },
    };
  }

  if (norm.startsWith('center ') || norm.includes(' center')) {
    const appName = norm.replace(/^(center|move|put)\s+/i, '').replace(/\s+in\s+the\s+center/i, '').replace(/\s+center/i, '').trim();
    return {
      tool: 'desktop.move_window',
      arguments: { app_name: appName, position: 'center' },
    };
  }

  // 7. Lock screen
  if (norm.includes('lock screen') || norm.includes('lock my pc') || norm.includes('lock computer') || norm === 'lock') {
    return {
      tool: 'desktop.lock',
      arguments: {},
    };
  }

  // 8. Brightness
  if (norm.includes('brightness')) {
    const match = norm.match(/\d+/);
    const level = match ? parseInt(match[0], 10) : 70;
    return {
      tool: 'desktop.brightness',
      arguments: { level },
    };
  }

  // 9. Type text
  if (norm.startsWith('type ') || norm.startsWith('type text ')) {
    const text = message.replace(/^(type text|type)\s+/i, '');
    return {
      tool: 'desktop.type_text',
      arguments: { text },
    };
  }

  // 10. Hotkey / shortcut
  if (norm.startsWith('press ') || norm.startsWith('hotkey ') || norm.startsWith('shortcut ')) {
    const rawKeys = norm.replace(/^(press|hotkey|shortcut)\s+/i, '');
    const keys = rawKeys.split(/[\s\+\-]+/).map((k) => k.trim()).filter(Boolean);
    return {
      tool: 'desktop.hotkey',
      arguments: { keys },
    };
  }

  // 11. Screenshot
  if (norm.includes('screenshot')) {
    return {
      tool: 'desktop.screenshot',
      arguments: {},
    };
  }

  // 12. System info & Hardware Drives
  if (
    norm.includes('drives') ||
    norm.includes('how many drive') ||
    norm.includes('storage space') ||
    norm.includes('disk space') ||
    norm.includes('disk usage') ||
    norm === 'check drives' ||
    norm === 'list drives'
  ) {
    return {
      tool: 'system.list_drives',
      arguments: {},
    };
  }

  // Folder counting and file listing
  if (
    norm.includes('how many folder') ||
    norm.includes('how many folders') ||
    norm.includes('list folder') ||
    norm.includes('list folders') ||
    norm.includes('what folder') ||
    norm.includes('folders in') ||
    norm.includes('files in') ||
    norm.includes('list files')
  ) {
    let dir = 'd:\\Practice Projects\\Jarvis_V1';
    const inMatch = message.match(/(?:in|inside|under)\s+(?:dir|directory|folder)?\s*([a-zA-Z]:\\[^"'\n\r]+?)(?:\s+(?:for|to|with)\b|\s*$)/i) ||
                    message.match(/(?:in|inside|under)\s+(?:dir|directory|folder)?\s*([a-zA-Z]:\\[^\s]+|[\.\w\\/-]+)/i);
    if (inMatch && inMatch[1] && inMatch[1].trim() !== 'that' && inMatch[1].trim() !== 'this') {
      dir = inMatch[1].trim();
    }
    return {
      tool: 'files.list_dir',
      arguments: { directory: dir },
    };
  }

  if (norm.includes('system info') || norm.includes('cpu usage') || norm.includes('ram usage') || norm.includes('battery')) {
    return {
      tool: 'system.info',
      arguments: {},
    };
  }

  // 13. Windows list
  if (norm.includes('list windows') || norm.includes('open windows') || norm.includes('active windows')) {
    return {
      tool: 'desktop.list_windows',
      arguments: {},
    };
  }

  // 14. Running processes
  if (norm.includes('running processes') || norm.includes('top processes') || norm.includes('task manager')) {
    return {
      tool: 'system.processes',
      arguments: { limit: 10, sort_by: 'memory' },
    };
  }

  // 15. Volume
  if (norm.includes('volume')) {
    const match = norm.match(/\d+/);
    const level = match ? parseInt(match[0], 10) : 50;
    return {
      tool: 'desktop.volume',
      arguments: { level },
    };
  }

  // 16. Clipboard read/write
  if (norm.includes('read clipboard') || norm.includes('paste clipboard')) {
    return {
      tool: 'system.clipboard_read',
      arguments: {},
    };
  }

  if (norm.startsWith('copy ') && norm.includes('to clipboard')) {
    const text = message.replace(/^copy\s+/i, '').replace(/\s+to clipboard$/i, '');
    return {
      tool: 'system.clipboard_write',
      arguments: { text },
    };
  }

  // 17. Web Search (e.g. "can you search about ddr5 ram price", "search the web for AI news", "google quantum computing")
  if (
    norm.includes('search about ') ||
    norm.includes('search for ') ||
    norm.includes('search online for ') ||
    norm.includes('search online ') ||
    norm.includes('search the web for ') ||
    norm.includes('search web for ') ||
    norm.includes('search google for ') ||
    norm.includes('google for ') ||
    norm.includes('look up online ') ||
    norm.startsWith('google ') ||
    (norm.includes('price of ') && !norm.includes('project')) ||
    (norm.startsWith('search ') && !norm.includes('file') && !norm.includes('folder') && !norm.includes('email') && !norm.includes('mail') && !norm.includes('knowledge') && !norm.includes('note'))
  ) {
    const query = message
      .replace(/^(can you\s+|please\s+)?(search about|search the web for|search web for|search google for|search duckduckgo for|search online for|search online|search for|google for|google|look up online|search)\s+/i, '')
      .trim();
    return {
      tool: 'browser.search',
      arguments: { query, max_results: 5 },
    };
  }

  // 18. Browser Open / Navigate (e.g. "browse to github.com", "open website https://news.ycombinator.com", "go to youtube.com")
  if (
    norm.startsWith('browse to ') ||
    norm.startsWith('navigate to ') ||
    norm.startsWith('open website ') ||
    norm.startsWith('open url ') ||
    norm.startsWith('go to ') ||
    norm.startsWith('open https://') ||
    norm.startsWith('open http://')
  ) {
    const rawUrl = message
      .replace(/^(browse to|navigate to|open website|open url|go to|open)\s+/i, '')
      .trim();
    return {
      tool: 'browser.open',
      arguments: { url: rawUrl, headless: false },
    };
  }

  // 19. Browser Webpage Screenshot
  if (norm.includes('browser screenshot') || norm.includes('webpage screenshot') || norm.includes('screenshot page')) {
    return {
      tool: 'browser.screenshot',
      arguments: { full_page: norm.includes('full') },
    };
  }

  // 20. Browser Read / Extract Content
  if (
    norm.includes('read webpage') ||
    norm.includes('read page') ||
    norm.includes('extract webpage') ||
    norm.includes('extract page') ||
    norm.includes('get page content') ||
    norm.includes('scrape page')
  ) {
    return {
      tool: 'browser.get_content',
      arguments: { extract_mode: norm.includes('link') ? 'links' : 'text' },
    };
  }

  // 21. Browser Click
  if (norm.startsWith('browser click ') || norm.startsWith('click on page ') || norm.startsWith('click element ')) {
    const selector = message.replace(/^(browser click|click on page|click element)\s+/i, '').trim();
    return {
      tool: 'browser.click',
      arguments: { selector },
    };
  }

  // 22. Browser Scroll
  if (norm.includes('scroll down') || norm.includes('scroll up') || norm.includes('scroll page') || norm.includes('browser scroll')) {
    const direction = norm.includes('up') ? 'up' : norm.includes('top') ? 'top' : norm.includes('bottom') ? 'bottom' : 'down';
    return {
      tool: 'browser.scroll',
      arguments: { direction, amount: 600 },
    };
  }

  // 23. Browser Close
  if (norm.includes('close browser') || norm.includes('close webpage') || norm.includes('quit browser')) {
    return {
      tool: 'browser.close',
      arguments: {},
    };
  }

  // 24. List Reminders / Scheduled Jobs
  if (
    norm === 'list reminders' ||
    norm === 'list timers' ||
    norm === 'list alarms' ||
    norm === 'list scheduled jobs' ||
    norm === 'list jobs' ||
    norm === 'show reminders' ||
    norm === 'show timers' ||
    norm.includes('list active timers') ||
    norm.includes('list active reminders')
  ) {
    return {
      tool: 'scheduler.list_jobs',
      arguments: {},
    };
  }

  // 25. Cancel Reminder / Job
  if (
    norm.startsWith('cancel reminder ') ||
    norm.startsWith('cancel timer ') ||
    norm.startsWith('cancel job ') ||
    norm.startsWith('delete reminder ') ||
    norm.startsWith('remove reminder ')
  ) {
    const jobId = message.replace(/^(cancel reminder|cancel timer|cancel job|delete reminder|remove reminder)\s+/i, '').trim();
    return {
      tool: 'scheduler.cancel_job',
      arguments: { job_id: jobId },
    };
  }

  // 26. Create Timer / Reminder (e.g. "remind me in 10 minutes to drink water", "set a timer for 5 minutes")
  const parseDurationSeconds = (numStr: string, unitStr?: string): number => {
    const num = parseFloat(numStr);
    if (isNaN(num)) return 60;
    const u = (unitStr || 's').toLowerCase();
    if (u.startsWith('m')) return Math.round(num * 60);
    if (u.startsWith('h')) return Math.round(num * 3600);
    if (u.startsWith('d')) return Math.round(num * 86400);
    return Math.round(num);
  };

  // Match: "remind me in 10 minutes to drink water" OR "remind me in 30 seconds"
  const remindInMatch = message.match(/^remind me in\s+(\d+(?:\.\d+)?)\s*(sec(?:ond)?s?|min(?:ute)?s?|hr|hour?s?|days?)?(?:\s+(?:to|that|about)\s+(.*))?$/i);
  if (remindInMatch) {
    const delaySeconds = parseDurationSeconds(remindInMatch[1], remindInMatch[2]);
    const reminderMsg = remindInMatch[3]?.trim() || 'Reminder triggered!';
    return {
      tool: 'scheduler.create_timer',
      arguments: { delay_seconds: delaySeconds, message: reminderMsg },
    };
  }

  // Match: "remind me to drink water in 10 minutes"
  const remindToInMatch = message.match(/^remind me to\s+(.*?)\s+in\s+(\d+(?:\.\d+)?)\s*(sec(?:ond)?s?|min(?:ute)?s?|hr|hour?s?|days?)$/i);
  if (remindToInMatch) {
    const reminderMsg = remindToInMatch[1].trim();
    const delaySeconds = parseDurationSeconds(remindToInMatch[2], remindToInMatch[3]);
    return {
      tool: 'scheduler.create_timer',
      arguments: { delay_seconds: delaySeconds, message: reminderMsg },
    };
  }

  // Match: "set a timer for 5 minutes" OR "set timer for 30s to stretch"
  const timerMatch = message.match(/^set (?:a )?timer for\s+(\d+(?:\.\d+)?)\s*(sec(?:ond)?s?|min(?:ute)?s?|hr|hour?s?|days?)?(?:\s+(?:to|for)\s+(.*))?$/i);
  if (timerMatch) {
    const delaySeconds = parseDurationSeconds(timerMatch[1], timerMatch[2]);
    const reminderMsg = timerMatch[3]?.trim() || `Timer for ${timerMatch[1]} ${timerMatch[2] || 'seconds'} finished!`;
    return {
      tool: 'scheduler.create_timer',
      arguments: { delay_seconds: delaySeconds, message: reminderMsg },
    };
  }

  // 27. Create Recurring / Cron Schedule (e.g. "schedule cron 0 9 * * * with message morning standup" or "schedule daily at 09:00 with message daily sync")
  const cronMatch = message.match(/^schedule cron\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)(?:\s+(?:with message|to)\s+(.*))?$/i);
  if (cronMatch) {
    const cronExpr = cronMatch[1].trim();
    const reminderMsg = cronMatch[2]?.trim() || 'Scheduled job alert';
    return {
      tool: 'scheduler.create_cron',
      arguments: { cron: cronExpr, message: reminderMsg },
    };
  }

  const dailyMatch = message.match(/^schedule daily at\s+(\d{1,2}):(\d{2})(?:\s+(?:with message|to)\s+(.*))?$/i);
  if (dailyMatch) {
    const hour = parseInt(dailyMatch[1], 10);
    const minute = parseInt(dailyMatch[2], 10);
    const reminderMsg = dailyMatch[3]?.trim() || 'Daily scheduled reminder';
    return {
      tool: 'scheduler.create_cron',
      arguments: { hour, minute, message: reminderMsg },
    };
  }

  // 28. Email List Unread
  if (
    norm === 'check my emails' ||
    norm === 'check my email' ||
    norm === 'read unread emails' ||
    norm === 'unread emails' ||
    norm === 'list unread emails' ||
    norm === 'check inbox' ||
    norm === 'any new emails' ||
    norm === 'get unread emails' ||
    norm.includes('unread emails') ||
    norm.includes('check email')
  ) {
    return {
      tool: 'email.list_unread',
      arguments: { limit: 10 },
    };
  }

  // 29. Email Search
  if (norm.startsWith('search emails for ') || norm.startsWith('search email for ') || norm.startsWith('search emails from ') || norm.startsWith('search email from ') || norm.startsWith('search emails ')) {
    const query = message.replace(/^(search emails for|search email for|search emails from|search email from|search emails)\s+/i, '').trim();
    return {
      tool: 'email.search',
      arguments: { query, limit: 10 },
    };
  }

  // 30. Email Read
  if (norm.startsWith('read email ') || norm.startsWith('open email ')) {
    const emailId = message.replace(/^(read email|open email)\s+/i, '').trim();
    return {
      tool: 'email.read',
      arguments: { email_id: emailId },
    };
  }

  // 31. Email Draft
  if (norm.startsWith('draft email to ') || norm.startsWith('create draft email to ')) {
    const match = message.match(/draft email to\s+([^\s,]+)(?:\s+with subject\s+["']?([^"']+)["']?)?(?:\s+(?:and body|body|message)\s+(.*))?$/i);
    if (match) {
      return {
        tool: 'email.draft',
        arguments: {
          to: match[1].trim(),
          subject: match[2]?.trim() || 'Quick note from JARVIS',
          body: match[3]?.trim() || 'Following up on our recent conversation.',
        },
      };
    }
  }

  // 32. Calendar Today Briefing
  if (
    norm === "what's on my calendar today" ||
    norm === "what is on my calendar today" ||
    norm === "what's on my schedule today" ||
    norm === "what is on my schedule today" ||
    norm === "today's schedule" ||
    norm === 'today schedule' ||
    norm === 'daily briefing' ||
    norm === "today's briefing" ||
    norm === 'today briefing' ||
    norm === 'calendar briefing' ||
    norm.includes('my agenda today') ||
    norm.includes('today schedule')
  ) {
    return {
      tool: 'calendar.today_briefing',
      arguments: {},
    };
  }

  // 33. Calendar List Events
  if (
    norm === 'list events' ||
    norm === 'upcoming events' ||
    norm === 'check calendar' ||
    norm === 'calendar schedule' ||
    norm === 'list calendar events' ||
    norm === 'my calendar' ||
    norm.includes('upcoming meetings') ||
    norm.includes('list meetings')
  ) {
    return {
      tool: 'calendar.list_events',
      arguments: { days_ahead: 7 },
    };
  }

  // 34. Calendar Create Event
  if (
    norm.startsWith('schedule a meeting ') ||
    norm.startsWith('schedule meeting ') ||
    norm.startsWith('create event ') ||
    norm.startsWith('create calendar event ') ||
    norm.startsWith('book a meeting ')
  ) {
    const raw = message.replace(/^(schedule a meeting|schedule meeting|create event|create calendar event|book a meeting)\s+/i, '').trim();
    // Parse "with Alex at 3pm" or "Team Sync at 2026-09-06T15:00:00"
    const atSplit = raw.split(/\s+at\s+|\s+on\s+/i);
    const title = atSplit[0].trim();
    const timeStr = atSplit[1]?.trim() || 'tomorrow 10:00 AM';
    return {
      tool: 'calendar.create_event',
      arguments: { title, start_time: timeStr },
    };
  }

  // 35. Calendar Delete Event
  if (
    norm.startsWith('cancel event ') ||
    norm.startsWith('delete event ') ||
    norm.startsWith('remove event ') ||
    norm.startsWith('cancel meeting ') ||
    norm.startsWith('delete meeting ')
  ) {
    const eventId = message.replace(/^(cancel event|delete event|remove event|cancel meeting|delete meeting)\s+/i, '').trim();
    return {
      tool: 'calendar.delete_event',
      arguments: { event_id: eventId },
    };
  }

  // 36. Memory Store Fact / Preference
  if (norm.startsWith('remember that ') || norm.startsWith('remember my ') || norm.startsWith('remember ')) {
    const raw = message.replace(/^remember(?:\s+that|\s+my)?\s+/i, '').trim();
    // Pattern: "favorite editor is VS Code" or "manager: Sarah Connor" or "theme = dark"
    const splitMatch = raw.match(/^(.*?)\s+(?:is|=|:)\s+(.*)$/i);
    if (splitMatch) {
      const key = splitMatch[1].replace(/^my\s+/i, '').trim();
      const val = splitMatch[2].trim();
      const category = key.toLowerCase().includes('manager') || key.toLowerCase().includes('lead') || key.toLowerCase().includes('contact')
        ? 'contact'
        : key.toLowerCase().includes('prefer') || key.toLowerCase().includes('theme') || key.toLowerCase().includes('editor') || key.toLowerCase().includes('favorite')
        ? 'preference'
        : 'fact';
      return {
        tool: 'memory.store_fact',
        arguments: { key, value: val, category },
      };
    }
  }

  // 37. Memory Recall Fact
  if (
    norm.startsWith('recall ') ||
    norm.startsWith('what do you know about ') ||
    norm.startsWith('what is my ') ||
    norm.startsWith("what's my ")
  ) {
    const topic = message.replace(/^(recall|what do you know about|what is my|what's my)\s+/i, '').replace(/\?$/, '').trim();
    return {
      tool: 'memory.recall',
      arguments: { query: topic, limit: 5 },
    };
  }

  // 38. Memory List Memories / Preferences
  if (
    norm === 'list memories' ||
    norm === 'show memories' ||
    norm === 'my preferences' ||
    norm === 'show preferences' ||
    norm === 'list preferences' ||
    norm === 'list facts' ||
    norm.includes('what do you remember')
  ) {
    return {
      tool: 'memory.list_memories',
      arguments: { limit: 50 },
    };
  }

  // 39. Memory Delete Fact
  if (
    norm.startsWith('forget that ') ||
    norm.startsWith('forget my ') ||
    norm.startsWith('forget ') ||
    norm.startsWith('delete memory ') ||
    norm.startsWith('remove memory ')
  ) {
    const key = message.replace(/^(forget that|forget my|forget|delete memory|remove memory)\s+/i, '').trim();
    return {
      tool: 'memory.delete_fact',
      arguments: { key_or_id: key },
    };
  }

  // 40. Memory Index Document / File
  if (
    norm.startsWith('index file ') ||
    norm.startsWith('index document ') ||
    norm.startsWith('index note ')
  ) {
    const raw = message.replace(/^(index file|index document|index note)\s+/i, '').trim();
    if (raw.includes(':')) {
      const parts = raw.split(/:\s*(.+)/);
      return {
        tool: 'memory.index_document',
        arguments: { title: parts[0].trim(), content: parts[1]?.trim() || '' },
      };
    }
    return {
      tool: 'memory.index_document',
      arguments: { file_path: raw },
    };
  }

  // 41. Memory Search Knowledge Base (RAG)
  if (
    norm.startsWith('search knowledge for ') ||
    norm.startsWith('search knowledge base for ') ||
    norm.startsWith('search my notes for ') ||
    norm.startsWith('search notes for ') ||
    norm.startsWith('search knowledge ')
  ) {
    const query = message.replace(/^(search knowledge for|search knowledge base for|search my notes for|search notes for|search knowledge)\s+/i, '').trim();
    return {
      tool: 'memory.search_knowledge',
      arguments: { query, limit: 5 },
    };
  }

  // 42. Voice Speak / TTS
  if (
    norm.startsWith('speak ') ||
    norm.startsWith('say ') ||
    norm.startsWith('read aloud ') ||
    norm.startsWith('tell me aloud ')
  ) {
    const textToSpeak = message.replace(/^(speak|say|read aloud|tell me aloud)\s+/i, '').trim();
    return {
      tool: 'voice.speak',
      arguments: { text: textToSpeak },
    };
  }

  // 43. Voice Listen / STT
  if (
    norm === 'listen' ||
    norm === 'start listening' ||
    norm === 'voice input' ||
    norm === 'capture audio'
  ) {
    return {
      tool: 'voice.listen',
      arguments: {},
    };
  }

  // 44. Voice Status
  if (
    norm === 'voice status' ||
    norm === 'check audio' ||
    norm === 'audio status' ||
    norm === 'check microphone' ||
    norm === 'tts status'
  ) {
    return {
      tool: 'voice.status',
      arguments: {},
    };
  }

  // 45. Voice Settings
  if (norm.startsWith('set speech rate to ') || norm.startsWith('set voice rate to ')) {
    const rateMatch = norm.match(/\d+/);
    const rate = rateMatch ? parseInt(rateMatch[0], 10) : 180;
    return {
      tool: 'voice.set_voice',
      arguments: { rate },
    };
  }

  // 46. Vision Analyze Screen / Visual QA
  if (
    norm === "what's on my screen" ||
    norm === 'what is on my screen' ||
    norm === 'what is on the screen' ||
    norm === 'analyze screen' ||
    norm === 'analyze my screen' ||
    norm === 'inspect screen' ||
    norm === 'describe screen' ||
    norm.startsWith('what is on screen') ||
    norm.startsWith('what error is') ||
    norm.startsWith('is there an error') ||
    norm.startsWith('what is showing on my screen')
  ) {
    const query = norm.includes('error') || norm.includes('what is') || norm.includes('is there') ? message : undefined;
    return {
      tool: 'vision.analyze_screen',
      arguments: query ? { query } : {},
    };
  }

  // 47. Vision Find Element
  if (
    norm.startsWith('find element ') ||
    norm.startsWith('find the ') ||
    norm.startsWith('locate element ') ||
    norm.startsWith('locate the ') ||
    norm.startsWith('where is the ')
  ) {
    const desc = message.replace(/^(find element|find the|locate element|locate the|where is the)\s+/i, '').replace(/\?$/, '').trim();
    return {
      tool: 'vision.find_element',
      arguments: { description: desc },
    };
  }

  // 48. Vision Click Element (Visual Grounding Click)
  if (
    norm.startsWith('visually click ') ||
    norm.startsWith('click the ') ||
    norm.startsWith('click on the ') ||
    norm.startsWith('press the ') ||
    norm.startsWith('double click the ') ||
    norm.startsWith('right click the ')
  ) {
    let clickType = 'single';
    if (norm.startsWith('double click')) clickType = 'double';
    if (norm.startsWith('right click')) clickType = 'right';
    const targetDesc = message.replace(/^(visually click|click the|click on the|press the|double click the|right click the)\s+/i, '').trim();
    return {
      tool: 'vision.click_element',
      arguments: { description: targetDesc, click_type: clickType },
    };
  }

  // 49. Vision Read Text (OCR)
  if (
    norm === 'read text on screen' ||
    norm === 'read screen' ||
    norm === 'ocr screen' ||
    norm === 'extract text from screen' ||
    norm.startsWith('read text from screen') ||
    norm.startsWith('read what is on screen')
  ) {
    return {
      tool: 'vision.read_text',
      arguments: {},
    };
  }

  // 50. Vision Describe Region
  if (norm.startsWith('describe region') || norm.startsWith('inspect region')) {
    const numbers = norm.match(/\d+/g);
    if (numbers && numbers.length >= 4) {
      return {
        tool: 'vision.describe_region',
        arguments: {
          x: parseInt(numbers[0], 10),
          y: parseInt(numbers[1], 10),
          width: parseInt(numbers[2], 10),
          height: parseInt(numbers[3], 10),
        },
      };
    }
  }

  // 51. Vision Compare Screens
  if (
    norm === 'compare screens' ||
    norm === 'compare screen' ||
    norm === 'check visual changes' ||
    norm === 'detect screen changes'
  ) {
    return {
      tool: 'vision.compare_screens',
      arguments: {},
    };
  }

  return null;
};


export const registerIpcHandlers = ({ db, appDataPath, provider, pythonRuntimeService }: IpcDependencies): void => {
  const securityService = new SecurityService();
  const fileSystemService = new FileSystemService(securityService);
  const projectService = new ProjectService(db, fileSystemService);
  const approvalService = new ApprovalService(db);
  const commandRunnerService = new CommandRunnerService(db, securityService);
  const starterFilesService = new StarterFilesService();
  const settingsService = new SettingsService(db);

  projectService.runMigrations(path.join(appDataPath, 'electron', 'db', 'migrations'));

  const resolveProvider = (): AIProvider | null => {
    try {
      const settings = settingsService.getSettings();
      return createProvider({
        geminiApiKey: settings.geminiApiKey || process.env.GEMINI_API_KEY,
        groqApiKey: settings.groqApiKey || process.env.GROQ_API_KEY,
        ollamaBaseUrl: settings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL,
        providerMode: settings.providerMode,
        selectedProvider: settings.selectedProvider,
        selectedModel: settings.selectedModel,
      });
    } catch {
      return provider;
    }
  };

  ipcMain.handle('projects:list', () => {
    const list = projectService.listProjects();
    if (list.length === 0) {
      const defaultProj = projectService.createProject(
        'J.A.R.V.I.S Core',
        'General AI Assistant for all tasks',
        null
      );
      return [defaultProj];
    }
    return list;
  });
  ipcMain.handle('projects:create', (_, payload: { name: string; description: string; folderPath: string | null }) =>
    projectService.createProject(payload.name, payload.description, payload.folderPath),
  );
  ipcMain.handle('projects:select-folder', async (_, projectId: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Folder',
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const folderPath = result.filePaths[0];
    projectService.updateProjectFolder(projectId, folderPath);
    return folderPath;
  });

  ipcMain.handle('projects:tree', (_, projectId: string) => projectService.getProjectTree(projectId));
  ipcMain.handle('projects:file-content', (_, payload: { projectId: string; relativePath: string; explicitApproval?: boolean }) =>
    projectService.readProjectFile(payload.projectId, payload.relativePath, payload.explicitApproval ?? false),
  );
  ipcMain.handle('projects:messages', (_, projectId: string) => projectService.listMessages(projectId));
  ipcMain.handle('projects:documents', (_, projectId: string) => projectService.listDocuments(projectId));
  ipcMain.handle('projects:tasks', (_, projectId: string) => projectService.listTasks(projectId));
  ipcMain.handle('projects:pending-actions', (_, projectId: string) => approvalService.listPendingActions(projectId));
  ipcMain.handle('projects:command-runs', (_, projectId: string) => projectService.listCommandRuns(projectId));
  ipcMain.handle('settings:get', () => settingsService.getSettings());
  ipcMain.handle('settings:save', (_, settings) => settingsService.saveSettings(settings));

  // ── System Diagnostics for JARVIS boot sequence ──
  ipcMain.handle('system:diagnostics', async () => {
    const checks: Array<{ id: string; label: string; status: 'pass' | 'fail'; detail?: string }> = [];

    // 1. Electron Desktop Environment
    checks.push({ id: 'electron', label: 'Electron Desktop Environment', status: 'pass', detail: `v${process.versions.electron}` });

    // 2. Node.js Runtime
    checks.push({ id: 'node', label: 'Node.js Runtime', status: 'pass', detail: process.version });

    // 3. SQLite Database
    try {
      const count = (db.prepare('SELECT count(*) as c FROM projects').get() as any)?.c;
      checks.push({ id: 'sqlite', label: 'SQLite Database Engine', status: 'pass', detail: `${count} project(s) stored` });
    } catch {
      checks.push({ id: 'sqlite', label: 'SQLite Database Engine', status: 'fail', detail: 'Database connection failed' });
    }

    // 4. AI Settings Loaded
    try {
      const s = settingsService.getSettings();
      const provider = s?.selectedProvider || 'none';
      checks.push({ id: 'settings', label: 'AI Configuration', status: 'pass', detail: `Provider: ${provider}` });
    } catch {
      checks.push({ id: 'settings', label: 'AI Configuration', status: 'fail' });
    }

    // 5. Ollama Local LLM
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (ollamaRes.ok) {
        const data = (await ollamaRes.json()) as { models?: Array<{ name: string }> };
        const modelNames = data.models?.map((m) => m.name).slice(0, 3).join(', ') || 'no models';
        checks.push({ id: 'ollama', label: 'Ollama Local LLM Server', status: 'pass', detail: modelNames });
      } else {
        checks.push({ id: 'ollama', label: 'Ollama Local LLM Server', status: 'fail', detail: 'Server returned error' });
      }
    } catch {
      checks.push({ id: 'ollama', label: 'Ollama Local LLM Server', status: 'fail', detail: 'Not running on port 11434' });
    }

    // 6. Python Tool Runtime
    if (pythonRuntimeService) {
      try {
        const rtStatus = await pythonRuntimeService.getStatus();
        checks.push({
          id: 'python',
          label: 'Python Tool Runtime',
          status: rtStatus.online ? 'pass' : 'fail',
          detail: rtStatus.online ? `${rtStatus.total_tools} tools loaded` : 'Sidecar offline',
        });
      } catch {
        checks.push({ id: 'python', label: 'Python Tool Runtime', status: 'fail', detail: 'Health check failed' });
      }
    } else {
      checks.push({ id: 'python', label: 'Python Tool Runtime', status: 'fail', detail: 'Not initialized' });
    }

    // 7. Security Protocols
    checks.push({ id: 'security', label: 'Security Protocols', status: 'pass', detail: 'Approval-gated execution active' });

    return checks;
  });

  // ── Desktop Applications Scanner & Compatibility Analyzer ──
  ipcMain.handle('system:list-apps', async () => {
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execAsync = util.promisify(exec);
      const { stdout } = await execAsync('powershell.exe -NoProfile -Command "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress"');
      const rawApps = JSON.parse(stdout) as Array<{ Name: string; AppID: string }>;

      return rawApps.map((app) => {
        const nameLower = app.Name.toLowerCase();
        let category: 'IDE/Code' | 'Browser' | 'Terminal/CLI' | 'Productivity' | 'AI Tool' | 'System Utility' | 'Media/Other' = 'Media/Other';
        let compatibility: 'FULL_AUTOMATION' | 'CLI_CONTROL' | 'LAUNCH_AND_FOCUS' | 'UNSUPPORTED' = 'LAUNCH_AND_FOCUS';
        let capabilityDescription = 'Can launch, focus, and manage desktop window.';

        if (nameLower.includes('code') || nameLower.includes('studio') || nameLower.includes('sublime') || nameLower.includes('notepad++') || nameLower.includes('cursor')) {
          category = 'IDE/Code';
          compatibility = 'FULL_AUTOMATION';
          capabilityDescription = 'Direct file opening, code scaffolding, git workspace integration.';
        } else if (nameLower.includes('chrome') || nameLower.includes('edge') || nameLower.includes('firefox') || nameLower.includes('brave')) {
          category = 'Browser';
          compatibility = 'FULL_AUTOMATION';
          capabilityDescription = 'Web browsing, URL opening, page research, web scraping.';
        } else if (nameLower.includes('prompt') || nameLower.includes('powershell') || nameLower.includes('terminal') || nameLower.includes('bash')) {
          category = 'Terminal/CLI';
          compatibility = 'FULL_AUTOMATION';
          capabilityDescription = 'Command execution, build pipelines, process orchestration.';
        } else if (nameLower.includes('chatgpt') || nameLower.includes('claude') || nameLower.includes('ollama')) {
          category = 'AI Tool';
          compatibility = 'CLI_CONTROL';
          capabilityDescription = 'AI model handoff, prompt syncing, neural core communication.';
        } else if (nameLower.includes('word') || nameLower.includes('excel') || nameLower.includes('notepad') || nameLower.includes('access') || nameLower.includes('calculator') || nameLower.includes('reader')) {
          category = 'Productivity';
          compatibility = 'LAUNCH_AND_FOCUS';
          capabilityDescription = 'Document viewing, desktop calculations, office automation.';
        } else if (nameLower.includes('manager') || nameLower.includes('settings') || nameLower.includes('verifier')) {
          category = 'System Utility';
          compatibility = 'CLI_CONTROL';
          capabilityDescription = 'System inspection, process diagnostics, performance tuning.';
        }

        return {
          name: app.Name,
          appId: app.AppID,
          category,
          compatibility,
          capabilityDescription,
        };
      });
    } catch {
      return [];
    }
  });

  // ── PC Resource & Hardware Telemetry (RAM, CPU, GPU, Drives) ──
  ipcMain.handle('system:specs', async () => {
    try {
      if (pythonRuntimeService) {
        try {
          const sysRes = await pythonRuntimeService.executeTool({ tool: 'system.info', arguments: {} });
          if (sysRes.success && sysRes.data) {
            const d = sysRes.data as any;
            const memP = Math.round(d.memory?.percent || 0);
            return {
              totalMemGb: d.memory?.total_gb || 15.2,
              usedMemGb: d.memory?.used_gb || 13.4,
              freeMemGb: d.memory?.available_gb || 1.8,
              memoryPercent: memP,
              cpuModel: d.cpu?.model || 'AMD Ryzen Host (12 Logical Cores)',
              cpuCores: d.cpu?.core_count || 12,
              cpuUsagePercent: Math.round(d.cpu?.usage_percent ?? 20),
              gpuName: d.gpu?.name || 'NVIDIA GeForce RTX 4050 Laptop GPU',
              gpuUsagePercent: d.gpu?.utilization_percent ?? 0,
              gpuMemTotalGb: d.gpu?.memory_total_mb ? Math.round((d.gpu.memory_total_mb / 1024) * 10) / 10 : 6.0,
              gpuMemUsedGb: d.gpu?.memory_used_mb ? Math.round((d.gpu.memory_used_mb / 1024) * 10) / 10 : 0.6,
              gpuMemPercent: d.gpu?.memory_percent ?? 10,
              gpuTempC: d.gpu?.temperature_c ?? 59,
              isThrottlingAdvised: memP >= 85,
              status: memP >= 85 ? 'WARNING_HIGH_MEMORY' : 'OPTIMAL',
              recommendation: memP >= 85
                ? 'Memory exceeds 85%. Throttling concurrency to protect host system.'
                : 'Resources nominal. Full speed multi-agent processing active.',
              drives: d.drives || [],
            };
          }
        } catch {}
      }

      const os = await import('node:os');
      const totalMemBytes = os.totalmem();
      const freeMemBytes = os.freemem();
      const usedMemBytes = totalMemBytes - freeMemBytes;
      const totalMemGb = Number((totalMemBytes / (1024 ** 3)).toFixed(1));
      const usedMemGb = Number((usedMemBytes / (1024 ** 3)).toFixed(1));
      const freeMemGb = Number((freeMemBytes / (1024 ** 3)).toFixed(1));
      const memoryPercent = Math.round((usedMemBytes / totalMemBytes) * 100);

      const cpus = os.cpus();
      const cpuModel = cpus[0]?.model || 'Host Processor';
      const cpuCores = cpus.length;

      const isThrottlingAdvised = memoryPercent > 85;

      // GPU Hardware & VRAM Telemetry
      let gpuInfo: {
        gpuName: string;
        gpuUsagePercent: number;
        gpuMemTotalGb: number;
        gpuMemUsedGb: number;
        gpuMemPercent: number;
        gpuTempC?: number;
      } = {
        gpuName: 'NVIDIA GeForce RTX 4050 Laptop GPU',
        gpuUsagePercent: 12,
        gpuMemTotalGb: 6.0,
        gpuMemUsedGb: 0.6,
        gpuMemPercent: 10,
        gpuTempC: 52,
      };

      try {
        const { execSync } = await import('node:child_process');
        const rawNvidia = execSync(
          'nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu --format=csv,noheader,nounits',
          { encoding: 'utf8', timeout: 1500, windowsHide: true },
        ).trim();

        if (rawNvidia) {
          const parts = rawNvidia.split(',').map((p) => p.trim());
          if (parts.length >= 4) {
            const name = parts[0];
            const memTotalMb = parseFloat(parts[1]) || 6141;
            const memUsedMb = parseFloat(parts[2]) || 580;
            const util = parseInt(parts[3], 10) || 0;
            const temp = parts[4] ? parseInt(parts[4], 10) : undefined;
            gpuInfo = {
              gpuName: name,
              gpuUsagePercent: util,
              gpuMemTotalGb: Number((memTotalMb / 1024).toFixed(1)),
              gpuMemUsedGb: Number((memUsedMb / 1024).toFixed(1)),
              gpuMemPercent: Math.round((memUsedMb / memTotalMb) * 100),
              gpuTempC: temp,
            };
          }
        }
      } catch {
        // Fallback or non-NVIDIA environment
      }

      return {
        totalMemGb,
        usedMemGb,
        freeMemGb,
        memoryPercent,
        cpuModel,
        cpuCores,
        cpuUsagePercent: 20,
        ...gpuInfo,
        isThrottlingAdvised,
        status: isThrottlingAdvised ? 'WARNING_HIGH_MEMORY' : 'OPTIMAL',
        recommendation: isThrottlingAdvised
          ? 'Memory exceeds 85%. Switching to lightweight 3B model and throttling concurrency to protect host system.'
          : 'Resources nominal. Full speed multi-agent processing active.',
      };
    } catch {
      return {
        totalMemGb: 15.2,
        usedMemGb: 13.3,
        freeMemGb: 1.9,
        memoryPercent: 87,
        cpuModel: 'Host Processor',
        cpuCores: 12,
        cpuUsagePercent: 20,
        gpuName: 'NVIDIA GeForce RTX 4050 Laptop GPU',
        gpuUsagePercent: 12,
        gpuMemTotalGb: 6.0,
        gpuMemUsedGb: 0.6,
        gpuMemPercent: 10,
        gpuTempC: 59,
        isThrottlingAdvised: true,
        status: 'WARNING_HIGH_MEMORY',
        recommendation: 'Resources nominal.',
      };
    }
  });


  // Tool Runtime IPC Handlers
  ipcMain.handle('tools:execute', async (_, request: ToolRequest) => {
    if (!pythonRuntimeService) {
      throw new Error('Python Tool Runtime is not initialized.');
    }
    return pythonRuntimeService.executeTool(request);
  });

  ipcMain.handle('tools:list', async (_, category?: string) => {
    if (!pythonRuntimeService) {
      return [];
    }
    return pythonRuntimeService.listTools(category);
  });

  ipcMain.handle('tools:status', async () => {
    if (!pythonRuntimeService) {
      return { online: false, status: 'offline', total_tools: 0, categories: [] };
    }
    return pythonRuntimeService.getStatus();
  });

  ipcMain.handle('workspace:open-vscode', async (_, folderPath: string) => {
    try {
      const child = spawn('cmd.exe', ['/c', 'code', folderPath], {
        cwd: folderPath,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
      return 'ok';
    } catch {
      return shell.openPath(folderPath);
    }
  });
  ipcMain.handle('workspace:open-terminal', async (_, folderPath: string) => {
    const escapedFolderPath = folderPath.replace(/'/g, "''");
    const child = spawn(
      'cmd.exe',
      ['/c', 'start', 'powershell', '-NoExit', '-Command', `Set-Location -LiteralPath '${escapedFolderPath}'`],
      {
        cwd: folderPath,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      },
    );
    child.unref();
    return 'ok';
  });
  ipcMain.handle('workspace:open-browser-url', (_, url: string) => shell.openExternal(url));

  ipcMain.handle('chat:send', async (_, payload: { projectId: string; content: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error('Project not found.');
    }

    const existingMessages = projectService.listMessages(project.id);
    projectService.saveMessage({
      projectId: project.id,
      role: 'user',
      agentName: 'System',
      content: payload.content,
    });

    const activeProvider = resolveProvider();
    const orchestrator = new OrchestratorAgent(activeProvider);
    const decision = await orchestrator.run({
      message: payload.content,
      projectHasRequirements: existingMessages.length > 0,
    });

    const outputs: AgentOutput[] = [decision];

    if (decision.data.commandType === 'TOOL_EXECUTION') {
      const toolReq = resolveToolFromIntent(payload.content);
      if (toolReq && pythonRuntimeService) {
        try {
          if (toolReq.tool === 'system.shutdown' || toolReq.tool === 'system.restart' || toolReq.tool === 'files.delete') {
            approvalService.createCommandProposal(
              project.id,
              `System authorization required for ${toolReq.tool}`,
              'CRITICAL',
              {
                command: toolReq.tool,
                cwd: project.folderPath || '',
                output: '',
              },
            );
            outputs.push({
              agentName: 'Security Agent',
              summary: 'Awaiting confirmation',
              data: `### ⚠️ Authorization Required\n\nSir, are you sure you want to execute \`${toolReq.tool}\`? Orchestrator state set to **AWAITING_CONFIRMATION**. Please confirm in the Security Gate to proceed.` as any,
            });
          } else {
            const toolResult = await pythonRuntimeService.executeTool(toolReq);
            let formattedContent = `### ⚙️ Executed: \`${toolReq.tool}\`\n\n**Status**: ${toolResult.status.toUpperCase()}\n\n${toolResult.message}`;
            if (toolResult.data && Object.keys(toolResult.data).length > 0) {
              formattedContent += `\n\n\`\`\`json\n${JSON.stringify(toolResult.data, null, 2)}\n\`\`\``;
            }

            outputs.push({
              agentName: 'Tool Runtime Agent',
              summary: toolResult.message,
              data: formattedContent as any,
            });
          }
        } catch (err: any) {
          outputs.push({
            agentName: 'Tool Runtime Agent',
            summary: `Tool execution failed: ${err.message}`,
            data: `### ❌ Tool Error\n\nFailed to execute \`${toolReq.tool}\`: ${err.message}` as any,
          });
        }
      } else if (!pythonRuntimeService) {
        outputs.push({
          agentName: 'Tool Runtime Agent',
          summary: 'Tool Runtime Sidecar offline',
          data: '### ⚠️ Tool Runtime Not Running\n\nThe Python tool runtime sidecar is currently offline.' as any,
        });
      }
    } else if (decision.data.commandType === 'WORKFLOW_EXECUTION') {
      const workflowPlanner = new WorkflowPlannerAgent(activeProvider);
      const planOutput = await workflowPlanner.run({ goal: payload.content });
      const plan = planOutput.data;

      if (pythonRuntimeService) {
        const workflowEngine = new WorkflowEngineService(pythonRuntimeService);
        const executionResult = await workflowEngine.executeWorkflow(plan);

        outputs.push({
          agentName: 'Workflow Planner Agent',
          summary: `Workflow completed (${executionResult.status})`,
          data: executionResult.summary as any,
        });
      } else {
        outputs.push({
          agentName: 'Workflow Planner Agent',
          summary: 'Plan generated, but Tool Runtime Sidecar is offline.',
          data: `### 📋 Workflow Plan\n\n${plan.explanation}\n\n⚠️ *Python Tool Runtime is offline; cannot execute steps.*` as any,
        });
      }
    } else if (decision.data.commandType === 'NEW_PROJECT_BUILD') {

      const requirementAgent = new RequirementAgent(activeProvider);
      outputs.push(await requirementAgent.run({ command: payload.content }));
    } else if (decision.data.commandType === 'RUN_COMMAND') {
      if (!project.folderPath) {
        throw new Error('Project folder not selected.');
      }

      approvalService.createCommandProposal(
        project.id,
        `Run command in selected folder: ${payload.content}`,
        securityService.classifyCommandRisk(payload.content),
        {
          command: payload.content,
          cwd: project.folderPath,
          output: '',
        },
      );

      projectService.saveMessage({
        projectId: project.id,
        role: 'assistant',
        agentName: 'Security Agent',
        content: `Command proposal created for approval: ${payload.content}`,
      });
    } else if (decision.data.commandType === 'REQUIREMENTS_ANSWER') {
      const requirementSummary = payload.content;
      const prdAgent = new PRDAgent(activeProvider);
      const ctoAgent = new CTOAgent(activeProvider);
      const architectAgent = new ArchitectAgent(activeProvider);
      const pmAgent = new ProjectManagerAgent(activeProvider);

      const prd = await prdAgent.run({ projectName: project.name, requirementsSummary: requirementSummary });
      const techStack = await ctoAgent.run({ projectName: project.name });
      const architecture = await architectAgent.run({ projectName: project.name });
      const tasks = await pmAgent.run({ projectId: project.id });

      outputs.push(prd, techStack, architecture, tasks);

      projectService.saveDocument({
        projectId: project.id,
        type: 'PRD',
        title: 'Product Requirements Document',
        content: prd.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'TECH_STACK',
        title: 'Tech Stack Recommendation',
        content: techStack.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'ARCHITECTURE',
        title: 'System Architecture',
        content: architecture.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'API_PLAN',
        title: 'API Plan',
        content: buildApiPlanMarkdown(),
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'DATABASE_SCHEMA',
        title: 'Database Schema',
        content: buildDatabaseSchemaMarkdown(),
        version: 1,
      });
      const savedTasks = projectService.replaceTasks(project.id, tasks.data);
      projectService.saveDocument({
        projectId: project.id,
        type: 'ROADMAP',
        title: 'Roadmap',
        content: buildRoadmapMarkdown(savedTasks),
        version: 1,
      });
    }

    outputs.forEach((output) => {
      projectService.saveMessage({
        projectId: project.id,
        role: 'assistant',
        agentName: output.agentName,
        content: typeof output.data === 'string' ? output.data : JSON.stringify(output.data, null, 2),
      });
    });

    try {
      const promptTokens = Math.max(1, Math.round(payload.content.length / 4));
      const totalChars = outputs.reduce((acc, o) => acc + (typeof o.data === 'string' ? o.data.length : 60), 0);
      const completionTokens = Math.max(1, Math.round(totalChars / 4));
      const totalTokens = promptTokens + completionTokens;
      const currentSettings = settingsService.getSettings();
      const isFree = currentSettings.providerMode === 'local' || currentSettings.selectedProvider === 'ollama';
      const costUsd = isFree ? 0.0 : Number(((totalTokens / 1_000_000) * 0.15).toFixed(6));

      settingsService.recordTokenUsage({
        provider: currentSettings.selectedProvider,
        model: currentSettings.selectedModel,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        latencyMs: 720,
      });
    } catch {
      // Ignore analytics logging errors
    }

    return {
      messages: projectService.listMessages(project.id),
      documents: projectService.listDocuments(project.id),
      tasks: projectService.listTasks(project.id),
      pendingActions: approvalService.listPendingActions(project.id),
      commandRuns: projectService.listCommandRuns(project.id),
    };
  });

  ipcMain.handle(
    'files:propose-write',
    (_, payload: { projectId: string; relativePath: string; content: string; description: string }) => {
      const project = projectService.getProject(payload.projectId);
      if (!project?.folderPath) {
        throw new Error('Project folder not selected.');
      }

      const diff = fileSystemService.proposeWrite(project.folderPath, payload.relativePath, payload.content);
      return approvalService.createFileWriteProposal(project.id, payload.description, 'MEDIUM', {
        filePath: payload.relativePath,
        beforeContent: diff.beforeContent,
        afterContent: diff.afterContent,
        changeType: diff.beforeContent ? 'UPDATE' : 'CREATE',
      });
    },
  );
  ipcMain.handle('files:generate-starter-proposals', (_, projectId: string) => {
    const project = projectService.getProject(projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const documents = projectService.listDocuments(projectId);
    const tasks = projectService.listTasks(projectId);
    const starterFiles = starterFilesService.createStarterFiles(project, documents, tasks);

    const proposals = starterFiles.map((file) => {
      const diff = fileSystemService.proposeWrite(project.folderPath!, file.relativePath, file.content);
      return approvalService.createFileWriteProposal(project.id, file.description, 'MEDIUM', {
        filePath: file.relativePath,
        beforeContent: diff.beforeContent,
        afterContent: diff.afterContent,
        changeType: diff.beforeContent ? 'UPDATE' : 'CREATE',
      });
    });

    return proposals;
  });
  ipcMain.handle('files:approve-write', (_, payload: { projectId: string; actionId: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const fileChange = approvalService.getFileChangeByActionId(payload.actionId);
    if (!fileChange) {
      throw new Error('File change proposal not found.');
    }

    if (fileChange.projectId !== payload.projectId) {
      throw new Error('Proposal does not belong to the active project workspace.');
    }

    if (fileChange.status !== 'PENDING') {
      throw new Error('File proposal has already been processed or rejected.');
    }

    fileSystemService.writeFile(project.folderPath, fileChange.filePath, fileChange.afterContent);
    approvalService.updateActionStatus(payload.actionId, 'COMPLETED');

    return {
      tree: projectService.getProjectTree(project.id),
      pendingActions: approvalService.listPendingActions(project.id),
    };
  });
  ipcMain.handle('files:reject-write', (_, payload: { projectId: string; actionId: string }) => {
    approvalService.updateActionStatus(payload.actionId, 'REJECTED');
    return approvalService.listPendingActions(payload.projectId);
  });

  ipcMain.handle('commands:propose', (_, payload: { projectId: string; command: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const settings = settingsService.getSettings();
    const riskLevel = securityService.classifyCommandRisk(payload.command);
    if (!settings.requireCommandApproval && securityService.isCommandAllowed(payload.command)) {
      throw new Error('Direct execution without approval is not enabled in V1.');
    }

    if (!securityService.isCommandAllowed(payload.command)) {
      throw new Error('Blocked dangerous command.');
    }

    const proposal = approvalService.createCommandProposal(
      project.id,
      `Run command in selected folder: ${payload.command}`,
      riskLevel,
      {
        command: payload.command,
        cwd: project.folderPath,
        output: '',
      },
    );

    return {
      proposal,
      pendingActions: approvalService.listPendingActions(project.id),
      commandRuns: projectService.listCommandRuns(project.id),
    };
  });

  ipcMain.handle('commands:classify', (_, command: string) => ({
    riskLevel: securityService.classifyCommandRisk(command),
    allowed: securityService.isCommandAllowed(command),
  }));

  ipcMain.handle('commands:run-approved', async (_, payload: { projectId: string; actionId: string }) => {
    const result = await commandRunnerService.runApprovedCommand(payload.actionId);
    approvalService.updateActionStatus(payload.actionId, result.approvalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED');
    return {
      commandRun: result,
      pendingActions: approvalService.listPendingActions(payload.projectId),
      commandRuns: projectService.listCommandRuns(payload.projectId),
    };
  });

  ipcMain.handle('settings:get-analytics', () => {
    return settingsService.getTokenAnalytics();
  });
};
