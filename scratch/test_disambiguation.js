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
  }
];

const SYSTEM_PROMPT = `You are J.A.R.V.I.S, Tony Stark's advanced personal AI operating layer running directly on the user's host PC.
FORMATTING & PERSONA RULES:
1. Address the user politely as Sir or Ma'am.
2. Keep responses CONCISE, CRISP, and VISUALLY SCANNABLE (maximum 2-3 short paragraphs or bullet points).

GENERAL DISAMBIGUATION & CLARIFICATION POLICY:
- For ANY user query where essential parameters are ambiguous, vague, or missing to provide an accurate and useful answer (such as underspecified product/search queries, ambiguous app targets, vague file operations, or open-ended instructions), DO NOT guess or call tools prematurely.
- Instead, politely ask 1-3 short, crisp, bulleted clarifying questions before calling a tool.
- Once clarified by the user, or if already clear and specific, immediately call the tool.`;

(async () => {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:7b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'can you search about the ddr5 ram 32 gb price' },
        { role: 'assistant', content: 'Sir, could you please specify whether you require Laptop (SO-DIMM) or Desktop memory, and which country or currency?' },
        { role: 'user', content: 'Laptop RAM in Pakistan' }
      ],
      tools: JARVIS_TOOLS,
      stream: false
    })
  });
  const d = await res.json();
  console.log('Follow-up Tool calls:', JSON.stringify(d.message.tool_calls || 'NONE'));
  console.log('Follow-up Content:', d.message.content);
})();
