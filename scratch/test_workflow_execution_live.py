import sys
import os
sys.path.insert(0, os.path.abspath("."))

import asyncio
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools import register_all_tools


async def main():
    print("[1/3] Initializing Tool Registry & Gateway...")
    reg = ToolRegistry()
    register_all_tools(reg)
    gateway = ToolGateway(registry=reg)

    print("\n[2/3] Executing Multi-Step Workflow...")
    
    # Step 1: System Info
    print(" -> Running Step 1: system.info...")
    res1 = await gateway.execute(ToolRequest(tool="system.info", arguments={}))
    assert res1.success is True
    cpu = res1.data.get("cpu", {}).get("usage_percent", 0)
    ram = res1.data.get("memory", {}).get("percent", 0)
    print(f"    Step 1 Complete: CPU={cpu}%, RAM={ram}%")

    # Step 2: Write interpolated report to file
    report_file = os.path.abspath("scratch/workflow_report.txt")
    print(f" -> Running Step 2: files.write to {report_file}...")
    report_content = f"JARVIS Multi-Step Automated Report\nCPU Usage: {cpu}%\nRAM Usage: {ram}%\nPlatform: Windows"
    res2 = await gateway.execute(ToolRequest(tool="files.write", arguments={"path": report_file, "content": report_content}))
    assert res2.success is True
    print("    Step 2 Complete: File written successfully.")

    # Step 3: Read file content back
    print(" -> Running Step 3: files.read verification...")
    res3 = await gateway.execute(ToolRequest(tool="files.read", arguments={"path": report_file}))
    assert res3.success is True
    print("    Step 3 Complete: File Content:\n" + "-"*40 + "\n" + res3.data.get("content", "") + "\n" + "-"*40)

    print("\n[3/3] Live Multi-Step Workflow Chain successfully completed!")


if __name__ == "__main__":
    asyncio.run(main())
