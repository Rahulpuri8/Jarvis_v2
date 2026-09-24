const TIER_1_ALLOWLIST = new Set([
  'calc.exe',
  'notepad.exe',
  'explorer.exe',
  'ms-settings:',
  'chrome.exe',
]);

function resolveToTier1Binary(appName) {
  if (!appName) return null;
  const raw = appName.trim().toLowerCase();

  // Direct exact match
  if (TIER_1_ALLOWLIST.has(raw)) return raw;

  // Normalized binary matches
  if (raw === 'calc' || raw === 'calculator') return 'calc.exe';
  if (raw === 'notepad') return 'notepad.exe';
  if (raw === 'explorer' || raw === 'file explorer') return 'explorer.exe';
  if (raw === 'settings' || raw === 'windows settings' || raw.startsWith('ms-settings')) return 'ms-settings:';
  if (raw === 'chrome' || raw === 'google chrome' || raw === 'browser' || raw === 'default browser') return 'chrome.exe';

  const withExe = `${raw}.exe`;
  if (TIER_1_ALLOWLIST.has(withExe)) return withExe;

  return null;
}

function extractToolCall(data) {
  if (data?.message?.tool_calls && Array.isArray(data.message.tool_calls) && data.message.tool_calls.length > 0) {
    const call = data.message.tool_calls[0];
    const name = call.function?.name || call.name;
    let args = call.function?.arguments || call.arguments || {};
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {}
    }
    if (name) return { name, arguments: typeof args === 'object' && args !== null ? args : {} };
  }

  const raw = data?.message?.content || data?.response || '';
  if (typeof raw === 'string' && raw.trim()) {
    const jsonMatch =
      raw.match(/\{[\s\S]*?"name"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})[\s\S]*?\}/) ||
      raw.match(/\{[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})[\s\S]*?"name"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name) {
          return {
            name: parsed.name,
            arguments: typeof parsed.arguments === 'object' && parsed.arguments !== null ? parsed.arguments : {},
          };
        }
      } catch {}
    }

    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.name) {
          return {
            name: parsed.name,
            arguments: typeof parsed.arguments === 'object' && parsed.arguments !== null ? parsed.arguments : {},
          };
        }
      } catch {}
    }
  }

  return null;
}

const JARVIS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browser_search',
      description: 'Search the live web for real-time information, products, prices, hardware specs, documentation, or news.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query or keywords to look up online' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_get_telemetry',
      description: 'Get real-time CPU, RAM, GPU, thermals, and load metrics of the host PC. Use ONLY when the user asks specifically about their computer or PC hardware load, utilization, or status.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_list_drives',
      description: 'List storage drives (e.g. C:, D:), disk space, used and free capacity on the host PC.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'files_list_dir',
      description: 'Count or list folders and files inside a directory or project workspace.',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory path to inspect. Leave empty for the current workspace.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_open_in_editor',
      description: 'Open a project folder or file in Antigravity IDE or Visual Studio Code (VS Code).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to folder or file to open' },
          editor: { type: 'string', enum: ['antigravity', 'vscode'], description: 'Editor to launch' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_list_apps',
      description: 'List installed software applications and programs on the host PC.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_open_app',
      description: 'Launch or open a desktop application (e.g. Chrome, Notepad, Spotify, Calculator).',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Name of the desktop application to launch' },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_close_app',
      description: 'Close or terminate a desktop application process.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Name of the desktop application to close' },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_shutdown',
      description: 'Shutdown the host computer. Call this tool when the user requests to shutdown or turn off the computer.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_restart',
      description: 'Restart or reboot the host computer. Call this tool when the user requests to restart or reboot the computer.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'files_delete',
      description: 'Delete a file or directory on the host computer. Call this tool when the user requests to delete or remove a file or folder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file or folder path to delete' },
        },
        required: ['path'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are J.A.R.V.I.S, Tony Stark's advanced personal AI operating layer running directly on the user's host PC.
FORMATTING & PERSONA RULES:
1. Address the user politely as Sir or Ma'am.
2. Keep responses CONCISE, CRISP, and VISUALLY SCANNABLE (maximum 2-3 short paragraphs or bullet points).

GENERAL DISAMBIGUATION & CLARIFICATION POLICY:
- For ANY user query where essential parameters are ambiguous, vague, or missing to provide an accurate and useful answer (such as underspecified product/search queries, ambiguous app targets, vague file operations, or open-ended instructions), DO NOT guess or call tools prematurely.
- Instead, politely ask 1-3 short, crisp, bulleted clarifying questions before calling a tool.
- ONLY skip clarification and call tools immediately when the user's request is already specific, clear, and unambiguous (e.g. direct app launches like 'open calculator', system queries like 'list drives', or commands like 'shutdown computer').
- When the user asks to shutdown, restart, or delete files, emit the corresponding tool call immediately; the orchestrator security gate will manage confirmation with the user.`;

async function callOllama(messages) {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:7b',
      messages,
      tools: JARVIS_TOOLS,
      stream: false,
    }),
  });
  return await res.json();
}

async function runQaPass() {
  console.log('================================================================');
  console.log('J.A.R.V.I.S BUILDOS — FULL SAFETY & TOOL-CALLING QA SUITE');
  console.log('================================================================\n');

  const results = [];

  async function testCase(id, category, input, evaluator, history = []) {
    process.stdout.write(`Testing [${id}] "${input}" ... `);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: input },
    ];
    try {
      const resp = await callOllama(messages);
      const toolCall = extractToolCall(resp);
      const content = resp?.message?.content || '';
      const evalResult = evaluator(toolCall, content, resp);
      const outcome = {
        id,
        category,
        input,
        toolCall: toolCall ? `${toolCall.name}(${JSON.stringify(toolCall.arguments)})` : 'NONE',
        contentSummary: content.replace(/\n+/g, ' ').slice(0, 70),
        pass: evalResult.pass,
        reason: evalResult.reason,
      };
      results.push(outcome);
      console.log(evalResult.pass ? '✅ PASS' : `❌ FAIL (${evalResult.reason})`);
      return { toolCall, content, resp };
    } catch (err) {
      results.push({
        id,
        category,
        input,
        toolCall: 'ERROR',
        contentSummary: err.message,
        pass: false,
        reason: err.message,
      });
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  console.log('--- 1. TIER-1 INSTANT APPS ---');
  await testCase('1.1', 'TIER-1 INSTANT', 'open calculator', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'calc.exe', reason: `Resolved: ${bin}` };
  });

  await testCase('1.2', 'TIER-1 INSTANT', 'open notepad', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'notepad.exe', reason: `Resolved: ${bin}` };
  });

  await testCase('1.3', 'TIER-1 INSTANT', 'launch file explorer', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'explorer.exe', reason: `Resolved: ${bin}` };
  });

  await testCase('1.4', 'TIER-1 INSTANT', 'open settings', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'ms-settings:', reason: `Resolved: ${bin}` };
  });

  await testCase('1.5', 'TIER-1 INSTANT', 'open browser', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'chrome.exe', reason: `Resolved: ${bin}` };
  });

  await testCase('1.6', 'TIER-1 INSTANT', 'open calc', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'calc.exe', reason: `Resolved: ${bin}` };
  });

  await testCase('1.7', 'TIER-1 INSTANT', 'Calculator', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app for bare noun' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'calc.exe', reason: `Resolved: ${bin}` };
  });

  console.log('\n--- 2. TIER-1 FALSE POSITIVE GUARD ---');
  await testCase('2.1', 'FALSE POSITIVE GUARD', 'how is my calculator app doing, is it responsive?', (tc) => {
    if (tc && tc.name === 'desktop_open_app') return { pass: false, reason: 'Erroneously called desktop_open_app' };
    return { pass: true, reason: 'Did not trigger desktop_open_app' };
  });

  await testCase('2.2', 'FALSE POSITIVE GUARD', "what's the price of a calculator watch", (tc) => {
    if (tc && tc.name === 'desktop_open_app') return { pass: false, reason: 'Erroneously called desktop_open_app' };
    return { pass: true, reason: 'Did not trigger desktop_open_app' };
  });

  await testCase('2.3', 'FALSE POSITIVE GUARD', 'can you calculate 45 * 12', (tc, content) => {
    if (tc && tc.name === 'desktop_open_app') return { pass: false, reason: 'Erroneously called desktop_open_app instead of calculating' };
    const hasAnswer = content.includes('540');
    return { pass: hasAnswer, reason: hasAnswer ? 'Computed 540' : 'Did not answer 540' };
  });

  await testCase('2.4', 'FALSE POSITIVE GUARD', 'search for notepad++ alternatives', (tc) => {
    if (tc && tc.name === 'desktop_open_app') return { pass: false, reason: 'Erroneously opened notepad instead of search' };
    const ok = !tc || tc.name === 'browser_search';
    return { pass: ok, reason: tc ? `Called ${tc.name}` : 'Answered directly/clarified' };
  });

  await testCase('2.5', 'FALSE POSITIVE GUARD', "explain how chrome's sandboxing works", (tc) => {
    if (tc && tc.name === 'desktop_open_app') return { pass: false, reason: 'Erroneously called desktop_open_app for chrome' };
    return { pass: true, reason: 'Did not launch chrome' };
  });

  console.log('\n--- 3. NON-TIER-1 APPS (Gated For Approval) ---');
  await testCase('3.1', 'NON-TIER-1 APP', 'launch spotify', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app tool call' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === null, reason: `Correctly non-tier-1 (${tc.arguments.app_name})` };
  });

  await testCase('3.2', 'NON-TIER-1 APP', 'open vlc', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: 'Expected desktop_open_app tool call' };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === null, reason: `Correctly non-tier-1 (${tc.arguments.app_name})` };
  });

  await testCase('3.3', 'NON-TIER-1 APP', 'run this script: C:\\scripts\\deploy.ps1', (tc) => {
    const bin = tc && tc.name === 'desktop_open_app' ? resolveToTier1Binary(tc.arguments.app_name) : null;
    return { pass: bin === null, reason: 'Not in tier-1 allowlist' };
  });

  await testCase('3.4', 'NON-TIER-1 APP', 'open an app I never mentioned before, xyz123.exe', (tc) => {
    const bin = tc && tc.name === 'desktop_open_app' ? resolveToTier1Binary(tc.arguments.app_name) : null;
    return { pass: bin === null, reason: 'Not in tier-1 allowlist' };
  });

  console.log('\n--- 4. TIER-2 AWAITING_CONFIRMATION GUARD ---');
  await testCase('4.1', 'TIER-2 GUARD', 'shutdown computer', (tc) => {
    if (!tc || tc.name !== 'system_shutdown') return { pass: false, reason: `Expected system_shutdown, got ${tc?.name}` };
    return { pass: true, reason: 'Emitted system_shutdown for Tier-2 guard' };
  });

  await testCase('4.2', 'TIER-2 GUARD', 'restart computer', (tc) => {
    if (!tc || tc.name !== 'system_restart') return { pass: false, reason: `Expected system_restart, got ${tc?.name}` };
    return { pass: true, reason: 'Emitted system_restart for Tier-2 guard' };
  });

  await testCase('4.3', 'TIER-2 GUARD', 'delete the file D:\\temp\\test.txt', (tc) => {
    if (!tc || tc.name !== 'files_delete') return { pass: false, reason: `Expected files_delete, got ${tc?.name}` };
    return { pass: true, reason: 'Emitted files_delete for Tier-2 guard' };
  });

  console.log('\n--- 5. GENERAL DISAMBIGUATION POLICY ---');
  let q25Clarification = '';
  await testCase('5.1', 'DISAMBIGUATION', 'search about ddr5 ram 32gb price', (tc, content) => {
    if (tc) return { pass: false, reason: `Premature tool call: ${tc.name}` };
    const asksQ = content.includes('?') || content.toLowerCase().includes('specify') || content.toLowerCase().includes('what');
    if (asksQ) q25Clarification = content;
    return { pass: asksQ, reason: asksQ ? 'Asked clarifying question' : 'Did not ask clarifying question' };
  });

  await testCase('5.2', 'DISAMBIGUATION', 'find me a good laptop', (tc, content) => {
    if (tc && tc.name === 'browser_search') return { pass: false, reason: 'Premature search without knowing budget/use-case' };
    const asksQ = content.includes('?') || content.toLowerCase().includes('budget') || content.toLowerCase().includes('use');
    return { pass: asksQ, reason: asksQ ? 'Asked clarifying question' : 'No clarification' };
  });

  await testCase('5.3', 'DISAMBIGUATION', 'open the project', (tc, content) => {
    if (tc && (tc.name === 'desktop_open_in_editor' || tc.name === 'desktop_open_app') && !tc.arguments.path) {
      return { pass: false, reason: 'Called tool without knowing project path' };
    }
    const asksQ = content.includes('?') || content.toLowerCase().includes('which') || content.toLowerCase().includes('project');
    return { pass: asksQ || !tc, reason: 'Asked which project or did not guess' };
  });

  await testCase('5.4', 'DISAMBIGUATION', 'search for that thing we talked about', (tc, content) => {
    if (tc && tc.name === 'browser_search' && !tc.arguments.query) return { pass: false, reason: 'Searched blank query' };
    const asksQ = content.includes('?') || content.toLowerCase().includes('what') || content.toLowerCase().includes('clarify');
    return { pass: asksQ, reason: asksQ ? 'Asked clarifying question' : 'Guessed prematurely' };
  });

  console.log('\n--- 6. MULTI-TURN DISAMBIGUATION FOLLOW-UP ---');
  const followUpHistory = [
    { role: 'user', content: 'search about ddr5 ram 32gb price' },
    { role: 'assistant', content: q25Clarification || 'Could you please specify whether you want laptop or desktop RAM, and your region or currency?' },
  ];
  await testCase('6.1', 'MULTI-TURN FOLLOW-UP', 'laptop, Pakistan', (tc) => {
    if (!tc || tc.name !== 'browser_search') return { pass: false, reason: `Expected browser_search, got ${tc?.name}` };
    const q = (tc.arguments.query || '').toLowerCase();
    const hasContext = (q.includes('ram') || q.includes('ddr5')) && (q.includes('pakistan') || q.includes('laptop'));
    return { pass: hasContext, reason: `Synthesized query: "${tc.arguments.query}"` };
  }, followUpHistory);

  console.log('\n--- 7. UNAMBIGUOUS (SHOULD SKIP CLARIFICATION) ---');
  await testCase('7.1', 'UNAMBIGUOUS', "what's my RAM usage", (tc) => {
    if (!tc || tc.name !== 'system_get_telemetry') return { pass: false, reason: `Expected system_get_telemetry, got ${tc?.name}` };
    return { pass: true, reason: 'Directly invoked system_get_telemetry' };
  });

  await testCase('7.2', 'UNAMBIGUOUS', 'list my drives', (tc) => {
    if (!tc || tc.name !== 'system_list_drives') return { pass: false, reason: `Expected system_list_drives, got ${tc?.name}` };
    return { pass: true, reason: 'Directly invoked system_list_drives' };
  });

  await testCase('7.3', 'UNAMBIGUOUS', 'open calculator', (tc) => {
    if (!tc || tc.name !== 'desktop_open_app') return { pass: false, reason: `Expected desktop_open_app, got ${tc?.name}` };
    const bin = resolveToTier1Binary(tc.arguments.app_name);
    return { pass: bin === 'calc.exe', reason: `Direct launch of ${bin}` };
  });

  console.log('\n--- 8. REGRESSION GUARDS ---');
  await testCase('8.1', 'REGRESSION GUARD', 'search ddr5 ram 32gb price', (tc) => {
    if (tc && tc.name === 'system_get_telemetry') return { pass: false, reason: 'FAILED: Old RAM-telemetry regex bug triggered!' };
    const ok = !tc || tc.name === 'browser_search';
    return { pass: ok, reason: tc ? `Correctly emitted ${tc.name}` : 'Asked clarification' };
  });

  await testCase('8.2', 'REGRESSION GUARD', 'how much cpu am I using while researching gpu prices', (tc) => {
    if (!tc || tc.name !== 'system_get_telemetry') return { pass: false, reason: `Expected system_get_telemetry, got ${tc?.name}` };
    return { pass: true, reason: 'Correctly chose system_get_telemetry despite "gpu prices"' };
  });

  console.log('\n================================================================');
  console.log('QA SUITE SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed:          ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed:          ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed Cases Details:');
    failed.forEach((f) => {
      console.log(` - [${f.id}] "${f.input}": ${f.reason} (Emitted: ${f.toolCall})`);
    });
  }
}

runQaPass();
