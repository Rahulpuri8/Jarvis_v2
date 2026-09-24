import os
import tempfile
import pytest
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools.memory import (
    register_memory_tools,
    memory_store_fact,
    memory_recall,
    memory_list_memories,
    memory_delete_fact,
    memory_index_document,
    memory_search_knowledge,
)


def test_memory_tools_registration():
    reg = ToolRegistry()
    register_memory_tools(reg)
    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "memory.store_fact",
        "memory.recall",
        "memory.list_memories",
        "memory.delete_fact",
        "memory.index_document",
        "memory.search_knowledge",
    ]
    for name in expected:
        assert name in tool_names
        defn, handler = reg.get(name)
        assert defn.category == "memory"
        assert callable(handler)


def test_store_recall_list_delete_fact():
    # 1. Store
    store_res = memory_store_fact(
        key="primary_programming_language",
        value="TypeScript and Python",
        category="preference",
        tags=["tech", "languages"],
    )
    assert store_res["action"] in ("stored", "updated")
    assert store_res["key"] == "primary_programming_language"

    # 2. Recall
    recall_res = memory_recall(query="TypeScript")
    assert recall_res["count"] > 0
    assert any("TypeScript" in m["value"] for m in recall_res["memories"])

    # 3. List
    list_res = memory_list_memories(category="preference")
    assert list_res["count"] > 0
    assert any(m["key"] == "primary_programming_language" for m in list_res["memories"])

    # 4. Delete
    del_res = memory_delete_fact(key_or_id="primary_programming_language")
    assert del_res["deleted"] is True


def test_index_and_search_knowledge():
    # Index raw text note
    index_res = memory_index_document(
        title="Deployment Architecture Guidelines",
        content="All production backend microservices must be deployed via Docker containers behind an NGINX reverse proxy with TLS 1.3.",
    )
    assert index_res["status"] == "indexed"
    assert index_res["chunks_indexed"] >= 1

    # Index a file
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "release_notes.md")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("# Version 1.5 Release Notes\nAdded high-speed offline local LLM inference and Playwright browser scrapers.")

        f_index_res = memory_index_document(file_path=test_file)
        assert f_index_res["status"] == "indexed"

    # Search via FTS5
    search_res = memory_search_knowledge(query="Docker microservices reverse proxy")
    assert search_res["count"] > 0
    assert any("Deployment Architecture" in r["title"] for r in search_res["results"])

    search_res2 = memory_search_knowledge(query="Playwright scrapers")
    assert search_res2["count"] > 0
    assert any("release_notes" in r["title"] for r in search_res2["results"])


@pytest.mark.asyncio
async def test_memory_gateway_invocation():
    reg = ToolRegistry()
    register_memory_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="memory.recall", arguments={"query": "theme"})
    res = await gateway.execute(req)
    assert res.success is True
    assert "memories" in res.data
