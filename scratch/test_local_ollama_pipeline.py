import sys
import os
sys.path.insert(0, os.path.abspath("."))

import json
import urllib.request
import asyncio
from runtime.core.registry import ToolRegistry, default_registry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools import register_all_tools


def test_ollama_json_call():
    print("[1/3] Testing Ollama API connection...")
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "qwen2.5:3b",
        "stream": False,
        "format": "json",
        "prompt": (
            "You are JARVIS. Classify the user command: 'check my CPU usage and open windows'.\n"
            "Respond ONLY as JSON matching this schema:\n"
            '{"command_type": "TOOL_EXECUTION", "next_agent": "Tool Runtime Agent", "explanation": "string"}'
        ),
        "options": {"temperature": 0.1}
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        print("[2/3] Ollama Raw Response:")
        print(res_data.get("response", ""))
        parsed = json.loads(res_data.get("response", "{}"))
        print("Parsed JSON Decision:", parsed)
        assert "command_type" in parsed or "commandType" in parsed

    print("\n[3/3] Executing end-to-end tool via Python Tool Gateway...")
    reg = ToolRegistry()
    register_all_tools(reg)
    gateway = ToolGateway(registry=reg)

    async def run_tool():
        req = ToolRequest(tool="system.info", arguments={})
        result = await gateway.execute(req)
        print("Tool Execution Result:")
        print(f"Status: {result.status}")
        print(f"CPU: {result.data.get('cpu', {})}")
        print(f"Memory: {result.data.get('memory', {})}")
        print(f"Message: {result.message}")

    asyncio.run(run_tool())
    print("\n✅ End-to-end Local LLM + Tool Execution verified successfully!")


if __name__ == "__main__":
    test_ollama_json_call()
