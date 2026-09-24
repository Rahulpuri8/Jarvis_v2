from unittest.mock import MagicMock, patch
import pytest
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.core.registry import ToolRegistry
from runtime.tools.browser import (
    register_browser_tools,
    browser_search,
    browser_close,
)


def test_browser_tools_registration():
    reg = ToolRegistry()
    register_browser_tools(reg)

    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "browser.open",
        "browser.navigate",
        "browser.screenshot",
        "browser.get_content",
        "browser.click",
        "browser.type",
        "browser.scroll",
        "browser.search",
        "browser.close",
    ]

    for name in expected:
        assert name in tool_names, f"Expected {name} to be registered"
        defn, handler = reg.get(name)
        assert defn is not None
        assert defn.category == "browser"
        assert callable(handler)


def test_browser_close_safe():
    res = browser_close()
    assert res["status"] == "closed"


@patch("runtime.tools.browser._browser_mgr.get_page")
def test_browser_search_mocked(mock_get_page):
    mock_page = MagicMock()
    mock_link = MagicMock()
    mock_link.inner_text.return_value = "Python Programming"
    mock_link.get_attribute.return_value = "https://python.org"

    mock_snippet = MagicMock()
    mock_snippet.inner_text.return_value = "Python is a programming language."

    mock_element = MagicMock()
    mock_element.query_selector.side_effect = lambda sel: mock_link if "title" in sel or "url" in sel else mock_snippet

    mock_page.query_selector_all.return_value = [mock_element]
    mock_get_page.return_value = mock_page

    res = browser_search("python", max_results=3)
    assert res["query"] == "python"
    assert res["count"] >= 1
    assert "Python" in res["results"][0]["title"]
    assert "python.org" in res["results"][0]["url"]


@pytest.mark.asyncio
async def test_gateway_browser_dispatch():
    reg = ToolRegistry()
    register_browser_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="browser.close", arguments={})
    res = await gateway.execute(req)

    assert res.success is True
    assert res.status == "completed"
    assert res.data["status"] == "closed"
