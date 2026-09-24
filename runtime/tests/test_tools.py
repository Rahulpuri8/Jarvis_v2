import pytest
import os
import tempfile
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools.system import get_system_info, list_processes
from runtime.tools.files import file_search, file_info, list_dir, read_text, write_text
from runtime.tools import register_all_tools


def test_system_info():
    info = get_system_info()
    assert "cpu" in info
    assert "memory" in info
    assert "disk" in info
    assert info["cpu"]["usage_percent"] >= 0.0


def test_list_processes():
    procs = list_processes(limit=5)
    assert "processes" in procs
    assert len(procs["processes"]) <= 5


def test_file_tools_roundtrip():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "test.txt")
        # Write
        w_res = write_text(test_file, "Hello JARVIS Tool Runtime!")
        assert w_res["saved"] is True

        # Read
        r_res = read_text(test_file)
        assert r_res["content"] == "Hello JARVIS Tool Runtime!"

        # Info
        i_res = file_info(test_file)
        assert i_res["is_file"] is True
        assert i_res["size_bytes"] > 0

        # List dir
        l_res = list_dir(tmpdir)
        assert l_res["total_items"] == 1

        # Search
        s_res = file_search(tmpdir, "*.txt")
        assert s_res["count"] == 1


@pytest.mark.asyncio
async def test_full_registry_execution():
    reg = ToolRegistry()
    register_all_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="system.info", arguments={})
    res = await gateway.execute(req)

    assert res.success is True
    assert res.status == "completed"
    assert "cpu" in res.data
