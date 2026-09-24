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
      name: 'desktop_open_app',
      description: 'Launch or open a desktop application (e.g. calc.exe, notepad.exe, explorer.exe, ms-settings:, chrome.exe).',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Binary name or identifier of the application (e.g. calc.exe, notepad.exe, explorer.exe, ms-settings:, chrome.exe)' },
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

async function testOllamaQuery(prompt, history = []) {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:7b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: prompt },
      ],
      tools: JARVIS_TOOLS,
      stream: false,
    }),
  });
  return await res.json();
}

async function runTests() {
  console.log('========================================================');
  console.log('J.A.R.V.I.S BUILDOS — 3 FEATURE VERIFICATION SUITE');
  console.log('========================================================\n');

  // TEST 1: Tier-1 Instant App Allowlist (Structured Check)
  console.log('--- TEST 1: Tier-1 Instant App Shortcut (Calculator) ---');
  const t1 = await testOllamaQuery('open calculator');
  const t1Call = extractToolCall(t1);
  console.log('Extracted Tool Call:', t1Call);
  const t1App = t1Call?.arguments?.app_name;
  const t1Resolved = resolveToTier1Binary(t1App);
  console.log(`Resolved Binary: "${t1App}" -> Tier-1 Match: "${t1Resolved}"`);
  console.log('Tier-1 Allowlist Test Result:', t1Resolved === 'calc.exe' ? '✅ PASSED (Instant Execution Allowed)' : '❌ FAILED');

  // TEST 1B: Non-Tier-1 App (Falls through to approval gate)
  console.log('\n--- TEST 1B: Non-Tier-1 App (Spotify) ---');
  const t1b = await testOllamaQuery('launch spotify');
  const t1bCall = extractToolCall(t1b);
  console.log('Extracted Tool Call:', t1bCall);
  const t1bApp = t1bCall?.arguments?.app_name;
  const t1bResolved = resolveToTier1Binary(t1bApp);
  console.log(`Resolved Binary: "${t1bApp}" -> Tier-1 Match:`, t1bResolved);
  console.log('Non-Tier-1 Gating Test Result:', t1bResolved === null ? '✅ PASSED (Correctly Gated for Approval)' : '❌ FAILED');

  // TEST 2: Tier-2 AWAITING_CONFIRMATION Guard
  console.log('\n--- TEST 2: Tier-2 Awaiting Confirmation Guard (Shutdown) ---');
  const t2 = await testOllamaQuery('shutdown computer');
  const t2Call = extractToolCall(t2);
  console.log('Extracted Tool Call:', t2Call);
  const isTier2 = t2Call?.name === 'system_shutdown' || t2Call?.name === 'system_restart' || t2Call?.name === 'files_delete';
  console.log('Tier-2 Guard Triggered:', isTier2 ? '✅ PASSED (Orchestrator enters AWAITING_CONFIRMATION)' : '❌ FAILED');

  // TEST 3: General Disambiguation Policy (Underspecified Query)
  console.log('\n--- TEST 3: General Disambiguation Policy (RAM Price Query) ---');
  const t3 = await testOllamaQuery('can you search about the ddr5 ram 32 gb price');
  const t3Call = extractToolCall(t3);
  const t3Text = t3?.message?.content || '';
  console.log('Extracted Tool Call:', t3Call);
  console.log('Jarvis Clarification Response:\n', t3Text);
  const isDisambiguating = t3Call === null && (t3Text.includes('?') || t3Text.toLowerCase().includes('specify'));
  console.log('Disambiguation Test Result:', isDisambiguating ? '✅ PASSED (Clarification asked before calling tool)' : '❌ FAILED');

  console.log('\n========================================================');
  console.log('ALL VERIFICATION CHECKS COMPLETE');
  console.log('========================================================');
}

runTests();
