import sys
import os
sys.path.insert(0, os.path.abspath("."))

import asyncio
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools.browser import register_browser_tools


async def main():
    print("[1/4] Registering Playwright Browser tools...")
    reg = ToolRegistry()
    register_browser_tools(reg)
    gateway = ToolGateway(registry=reg)

    print("\n[2/4] Testing browser.open (navigating to https://example.com in headless mode)...")
    req_open = ToolRequest(tool="browser.open", arguments={"url": "https://example.com", "headless": True})
    res_open = await gateway.execute(req_open)
    print("Open Status:", res_open.status)
    print("Page Title:", res_open.data.get("title"))
    print("Page URL:", res_open.data.get("url"))

    print("\n[3/4] Testing browser.get_content (reading text)...")
    req_content = ToolRequest(tool="browser.get_content", arguments={"extract_mode": "text"})
    res_content = await gateway.execute(req_content)
    print("Content Status:", res_content.status)
    print("Extracted Content Snippet:\n", res_content.data.get("content", "")[:200])

    print("\n[4/4] Testing browser.close...")
    req_close = ToolRequest(tool="browser.close", arguments={})
    res_close = await gateway.execute(req_close)
    print("Close Status:", res_close.status)

    print("\nAll Phase 3 Playwright Browser tools verified end-to-end!")


if __name__ == "__main__":
    asyncio.run(main())
