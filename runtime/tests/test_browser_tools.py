from unittest.mock import MagicMock, patch
import pytest
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.core.registry import ToolRegistry
from runtime.tools.browser import (
    register_browser_tools,
    browser_search,
    browser_close,
    browser_inspect,
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
        "browser.inspect",
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
def test_browser_inspect_returns_grounded_controls(mock_get_page):
    page = MagicMock()
    page.url = "https://example.com"
    page.title.return_value = "Example"
    page.evaluate.return_value = [{"tag": "a", "text": "Pricing", "selector": "a:has-text(\"Pricing\")"}]
    mock_get_page.return_value = page
    result = browser_inspect()
    assert result["elements"][0]["text"] == "Pricing"
    assert result["url"] == "https://example.com"


@patch("urllib.request.urlopen")
def test_browser_search_mocked(mock_urlopen):
    response = MagicMock()
    response.read.return_value = b'<table><tr><td><a class="result-link" href="https://python.org">Python Programming</a></td><td class="result-snippet">Python is a programming language.</td></tr></table>'
    mock_urlopen.return_value.__enter__.return_value = response

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
