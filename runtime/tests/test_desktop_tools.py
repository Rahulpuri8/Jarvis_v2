import pytest
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.tools.desktop import (
    open_app,
    close_app,
    set_volume,
    list_windows,
    focus_app,
    minimize_window,
    maximize_window,
    move_window,
    type_text,
    hotkey,
    register_desktop_tools,
)


def test_list_windows():
    res = list_windows()
    assert "total_windows" in res
    assert "windows" in res
    assert isinstance(res["windows"], list)


def test_volume_tool():
    res = set_volume(45)
    assert res["volume_level"] == 45


def test_window_presets():
    res = move_window("test_app", position="left_half")
    assert res["moved"] is True
    assert "bounds" in res
    assert res["bounds"]["x"] == 0


def test_minimize_and_maximize():
    res_min = minimize_window("notepad")
    assert res_min["minimized"] is True

    res_max = maximize_window("notepad")
    assert res_max["maximized"] is True


def test_hotkey_simulation():
    res = hotkey(["ctrl", "c"])
    assert "ctrl+c" in res["hotkey"]


@pytest.mark.asyncio
async def test_gateway_desktop_dispatch():
    reg = ToolRegistry()
    register_desktop_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="desktop.volume", arguments={"level": 60})
    res = await gateway.execute(req)

    assert res.success is True
    assert res.status == "completed"
    assert res.data["volume_level"] == 60
