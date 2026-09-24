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
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'system_list_drives',
      description: 'List storage drives (e.g. C:, D:), disk space, used and free capacity on the host PC.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  }
];

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

(async () => {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:7b',
      messages: [
        {
          role: 'system',
          content: `You are J.A.R.V.I.S, Tony Stark's advanced personal AI desktop assistant running directly on the user's host PC.
FORMATTING & PERSONA RULES:
1. Address the user politely as Sir or Ma'am.
2. Keep responses CONCISE, CRISP, and VISUALLY SCANNABLE (maximum 2-3 short paragraphs or bullet points).
3. Call the appropriate tool when the user's request requires external actions, live web search, file or directory inspection, hardware telemetry, or app control.
4. If no tool is needed, respond directly with crisp, helpful insights. Never output long walls of text.`
        },
        {
          role: 'user',
          content: 'can you search about the ddr5 ram 32 gb price'
        }
      ],
      tools: JARVIS_TOOLS,
      stream: false
    })
  });
  const chatData = await res.json();
  console.log('chatData message:', JSON.stringify(chatData.message, null, 2));
  const tc = extractToolCall(chatData);
  console.log('Extracted tool call:', JSON.stringify(tc, null, 2));
})();
