"""
Comprehensive End-to-End System Verification Script for JARVIS V1
Tests all 8 Phases live in one continuous automated validation sequence.
"""

import asyncio
import os
import sys
import tempfile
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools import register_all_tools


async def run_live_system_audit():
    print("=" * 65)
    print("[JARVIS V1] FULL END-TO-END SYSTEM HEALTH & CAPABILITY AUDIT")
    print("=" * 65)

    # 1. Initialize Registry & Gateway
    reg = ToolRegistry()
    register_all_tools(reg)
    gateway = ToolGateway(registry=reg)
    tools = reg.list_tools()
    print(f"\n[1/8] TOOL REGISTRY STATUS: {len(tools)} tools registered across all suites.")
    categories = {}
    for t in tools:
        categories[t.category] = categories.get(t.category, 0) + 1
    for cat, count in categories.items():
        print(f"  * {cat.upper():12}: {count} active tools")

    # 2. Test System & Hardware Diagnostics (Phase 2)
    print("\n[2/8] TESTING HARDWARE & SYSTEM TOOLS...")
    diag_req = ToolRequest(tool="system.info", arguments={})
    diag_res = await gateway.execute(diag_req)
    assert diag_res.success is True
    print(f"  [PASS] CPU Usage: {diag_res.data['cpu']['usage_percent']}% | RAM: {diag_res.data['memory']['percent']}%")

    # 3. Test File Operations (Phase 2)
    print("\n[3/8] TESTING LOCAL FILE SYSTEM OPS...")
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "jarvis_audit.txt")
        w_req = ToolRequest(tool="files.write", arguments={"path": test_file, "content": "JARVIS Live Verification"})
        w_res = await gateway.execute(w_req)
        assert w_res.success is True
        r_req = ToolRequest(tool="files.read", arguments={"path": test_file})
        r_res = await gateway.execute(r_req)
        assert "JARVIS Live Verification" in r_res.data["content"]
        print("  [PASS] Safe File Read/Write roundtrip verified.")

    # 4. Test Web Search & Browser Suite (Phase 3)
    print("\n[4/8] TESTING PLAYWRIGHT & BROWSER SEARCH...")
    search_req = ToolRequest(tool="browser.search", arguments={"query": "Google Gemini 2.5 Flash", "max_results": 2})
    search_res = await gateway.execute(search_req)
    assert search_res.success is True
    print(f"  [PASS] Web Search returned {search_res.data['count']} live results.")

    # 5. Test APScheduler Background Timers (Phase 5)
    print("\n[5/8] TESTING BACKGROUND SCHEDULER & TIMERS...")
    timer_req = ToolRequest(tool="scheduler.create_timer", arguments={"delay_seconds": 60, "message": "Standup reminder"})
    timer_res = await gateway.execute(timer_req)
    assert timer_res.success is True
    job_id = timer_res.data["job_id"]
    cancel_req = ToolRequest(tool="scheduler.cancel_job", arguments={"job_id": job_id})
    cancel_res = await gateway.execute(cancel_req)
    assert cancel_res.success is True
    print("  [PASS] APScheduler Timer creation & cancellation verified.")

    # 6. Test Email & Calendar Workspace (Phase 6)
    print("\n[6/8] TESTING EMAIL & CALENDAR WORKSPACE...")
    email_req = ToolRequest(tool="email.list_unread", arguments={"limit": 3})
    email_res = await gateway.execute(email_req)
    assert email_res.success is True
    print(f"  [PASS] Email unread ingestion verified: {email_res.data['count']} message(s) fetched.")

    cal_req = ToolRequest(tool="calendar.today_briefing", arguments={})
    cal_res = await gateway.execute(cal_req)
    assert cal_res.success is True
    print(f"  [PASS] Calendar daily briefing verified: {cal_res.data['total_events']} scheduled event(s).")

    # 7. Test Long-Term Memory & Knowledge Base FTS5 (Phase 7)
    print("\n[7/8] TESTING LONG-TERM MEMORY & KNOWLEDGE RAG...")
    mem_req = ToolRequest(tool="memory.store_fact", arguments={"key": "editor_choice", "value": "Visual Studio Code", "category": "preference"})
    mem_res = await gateway.execute(mem_req)
    assert mem_res.success is True

    recall_req = ToolRequest(tool="memory.recall", arguments={"query": "editor_choice"})
    recall_res = await gateway.execute(recall_req)
    assert recall_res.success is True
    print("  [PASS] Memory fact storage & instant recall verified.")

    doc_req = ToolRequest(tool="memory.index_document", arguments={"title": "JARVIS Core Spec", "content": "JARVIS runs on Electron TypeScript and Python Fast Gateway."})
    doc_res = await gateway.execute(doc_req)
    assert doc_res.success is True

    rag_req = ToolRequest(tool="memory.search_knowledge", arguments={"query": "TypeScript Fast Gateway"})
    rag_res = await gateway.execute(rag_req)
    assert rag_res.success is True
    print(f"  [PASS] SQLite FTS5 BM25 knowledge search returned {rag_res.data['count']} matching snippet(s).")

    # 8. Test Voice Assistant STT & TTS (Phase 8)
    print("\n[8/9] TESTING VOICE ASSISTANT (TTS & STT)...")
    voice_status_req = ToolRequest(tool="voice.status", arguments={})
    voice_status_res = await gateway.execute(voice_status_req)
    assert voice_status_res.success is True

    voice_listen_req = ToolRequest(tool="voice.listen", arguments={"simulate_input": "JARVIS briefing complete"})
    voice_listen_res = await gateway.execute(voice_listen_req)
    assert voice_listen_res.success is True
    print(f"  [PASS] Offline Voice Engine ready: TTS available={voice_status_res.data['tts_available']}, Voices={voice_status_res.data['voices_count']}")

    # 9. Test Computer Vision & Screen Grounding (Phase 9)
    print("\n[9/9] TESTING COMPUTER VISION & SCREEN GROUNDING...")
    vis_analyze_req = ToolRequest(tool="vision.analyze_screen", arguments={"query": "active window and theme"})
    vis_analyze_res = await gateway.execute(vis_analyze_req)
    assert vis_analyze_res.success is True
    print(f"  [PASS] Screen Vision Analysis: {vis_analyze_res.data['resolution']['width']}x{vis_analyze_res.data['resolution']['height']} ({vis_analyze_res.data['theme']} theme)")

    vis_find_req = ToolRequest(tool="vision.find_element", arguments={"description": "Close button", "element_type": "button"})
    vis_find_res = await gateway.execute(vis_find_req)
    assert vis_find_res.success is True
    assert vis_find_res.data["found"] is True
    print(f"  [PASS] Visual UI Grounding: Located '{vis_find_res.data['element']}' at coordinates ({vis_find_res.data['coordinates']['center_x']}, {vis_find_res.data['coordinates']['center_y']})")

    vis_ocr_req = ToolRequest(tool="vision.read_text", arguments={})
    vis_ocr_res = await gateway.execute(vis_ocr_req)
    assert vis_ocr_res.success is True
    print(f"  [PASS] Screen OCR text reading verified ({vis_ocr_res.data['blocks_count']} text blocks parsed)")

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL 9 PHASES OPERATIONAL WITH 100% PASSING CHECKS!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_live_system_audit())

