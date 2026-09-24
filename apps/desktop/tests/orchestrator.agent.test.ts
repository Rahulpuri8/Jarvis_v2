import { describe, expect, it } from 'vitest';
import { OrchestratorAgent } from '../../../packages/agents/orchestrator.agent';

describe('OrchestratorAgent Tool Intent Detection', () => {
  const orchestrator = new OrchestratorAgent(null);

  it('detects desktop app launch commands', async () => {
    const result = await orchestrator.run({ message: 'open Chrome', projectHasRequirements: false });
    expect(result.data.commandType).toBe('TOOL_EXECUTION');
    expect(result.data.nextAgent).toBe('Tool Runtime Agent');
  });

  it('detects desktop app close commands', async () => {
    const result = await orchestrator.run({ message: 'close Notepad', projectHasRequirements: false });
    expect(result.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects screenshot requests', async () => {
    const result = await orchestrator.run({ message: 'take a screenshot of my screen', projectHasRequirements: false });
    expect(result.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects system diagnostic queries', async () => {
    const result = await orchestrator.run({ message: 'check my cpu usage and memory', projectHasRequirements: false });
    expect(result.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects volume control', async () => {
    const result = await orchestrator.run({ message: 'set volume to 80', projectHasRequirements: false });
    expect(result.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects window minimize and maximize requests', async () => {
    const minRes = await orchestrator.run({ message: 'minimize Chrome', projectHasRequirements: false });
    expect(minRes.data.commandType).toBe('TOOL_EXECUTION');

    const maxRes = await orchestrator.run({ message: 'maximize VS Code', projectHasRequirements: false });
    expect(maxRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects lock screen and brightness commands', async () => {
    const lockRes = await orchestrator.run({ message: 'lock screen', projectHasRequirements: false });
    expect(lockRes.data.commandType).toBe('TOOL_EXECUTION');

    const brightRes = await orchestrator.run({ message: 'set brightness to 60%', projectHasRequirements: false });
    expect(brightRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects close all except commands', async () => {
    const res = await orchestrator.run({ message: 'close all except Chrome and VS Code', projectHasRequirements: false });
    expect(res.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects web search and browser commands', async () => {
    const searchRes = await orchestrator.run({ message: 'search the web for latest AI news', projectHasRequirements: false });
    expect(searchRes.data.commandType).toBe('TOOL_EXECUTION');
    expect(searchRes.data.nextAgent).toBe('Tool Runtime Agent');

    const browseRes = await orchestrator.run({ message: 'browse to https://github.com/trending', projectHasRequirements: false });
    expect(browseRes.data.commandType).toBe('TOOL_EXECUTION');

    const extractRes = await orchestrator.run({ message: 'read webpage content', projectHasRequirements: false });
    expect(extractRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects reminder and scheduler intents', async () => {
    const remindRes = await orchestrator.run({ message: 'remind me in 10 minutes to drink water', projectHasRequirements: false });
    expect(remindRes.data.commandType).toBe('TOOL_EXECUTION');
    expect(remindRes.data.nextAgent).toBe('Tool Runtime Agent');

    const timerRes = await orchestrator.run({ message: 'set a timer for 5 minutes', projectHasRequirements: false });
    expect(timerRes.data.commandType).toBe('TOOL_EXECUTION');

    const listRes = await orchestrator.run({ message: 'list reminders', projectHasRequirements: false });
    expect(listRes.data.commandType).toBe('TOOL_EXECUTION');

    const cancelRes = await orchestrator.run({ message: 'cancel reminder job_12345', projectHasRequirements: false });
    expect(cancelRes.data.commandType).toBe('TOOL_EXECUTION');

    const cronRes = await orchestrator.run({ message: 'schedule daily at 09:00 with message standup', projectHasRequirements: false });
    expect(cronRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects email and calendar tool intents', async () => {
    const emailRes = await orchestrator.run({ message: 'check my unread emails', projectHasRequirements: false });
    expect(emailRes.data.commandType).toBe('TOOL_EXECUTION');
    expect(emailRes.data.nextAgent).toBe('Tool Runtime Agent');

    const calRes = await orchestrator.run({ message: "what's on my calendar today", projectHasRequirements: false });
    expect(calRes.data.commandType).toBe('TOOL_EXECUTION');

    const meetingRes = await orchestrator.run({ message: 'schedule a meeting with Alex at 3pm', projectHasRequirements: false });
    expect(meetingRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects memory and knowledge tool intents', async () => {
    const memRes = await orchestrator.run({ message: 'remember that my favorite editor is VS Code', projectHasRequirements: false });
    expect(memRes.data.commandType).toBe('TOOL_EXECUTION');
    expect(memRes.data.nextAgent).toBe('Tool Runtime Agent');

    const recallRes = await orchestrator.run({ message: 'what do you know about Sarah?', projectHasRequirements: false });
    expect(recallRes.data.commandType).toBe('TOOL_EXECUTION');

    const searchRes = await orchestrator.run({ message: 'search knowledge for deployment guidelines', projectHasRequirements: false });
    expect(searchRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('detects voice assistant tool intents', async () => {
    const speakRes = await orchestrator.run({ message: 'speak Hello world, I am JARVIS', projectHasRequirements: false });
    expect(speakRes.data.commandType).toBe('TOOL_EXECUTION');
    expect(speakRes.data.nextAgent).toBe('Tool Runtime Agent');

    const listenRes = await orchestrator.run({ message: 'listen', projectHasRequirements: false });
    expect(listenRes.data.commandType).toBe('TOOL_EXECUTION');

    const statusRes = await orchestrator.run({ message: 'voice status', projectHasRequirements: false });
    expect(statusRes.data.commandType).toBe('TOOL_EXECUTION');
  });

  it('still routes project build requests appropriately', async () => {
    const result = await orchestrator.run({ message: "let's build a new crypto tracker", projectHasRequirements: false });
    expect(result.data.commandType).toBe('NEW_PROJECT_BUILD');
    expect(result.data.nextAgent).toBe('Requirement Agent');
  });
});

