"""
Web and Browser Automation tool implementations for JARVIS using Playwright.
Provides tools for web browsing, search, interaction, content extraction, and screenshots.
"""

from __future__ import annotations

import os
import re
import tempfile
import urllib.parse
from typing import Any, Dict, List, Optional

from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry


class BrowserManager:
    """Manages the lifecycle of a Playwright browser instance."""

    _instance: Optional[BrowserManager] = None

    def __init__(self) -> None:
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    @classmethod
    def get_instance(cls) -> BrowserManager:
        if cls._instance is None:
            cls._instance = BrowserManager()
        return cls._instance

    def _ensure_browser(self, headless: bool = False):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise RuntimeError("Playwright is not installed. Please run `pip install playwright && playwright install chromium`.")

        if self._playwright is None:
            self._playwright = sync_playwright().start()

        if self._browser is None or not self._browser.is_connected():
            self._browser = self._playwright.chromium.launch(
                headless=headless,
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
            )
            self._context = self._browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            self._page = self._context.new_page()

        return self._page

    def get_page(self, create_if_none: bool = True, headless: bool = False):
        if self._page is None or self._page.is_closed():
            if create_if_none:
                return self._ensure_browser(headless=headless)
            return None
        return self._page

    def close(self) -> None:
        try:
            if self._page and not self._page.is_closed():
                self._page.close()
            if self._context:
                self._context.close()
            if self._browser and self._browser.is_connected():
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        except Exception:
            pass
        finally:
            self._page = None
            self._context = None
            self._browser = None
            self._playwright = None


_browser_mgr = BrowserManager.get_instance()


# ---------------------------------------------------------------------------
# Tool Handlers
# ---------------------------------------------------------------------------


def browser_open(url: str = "https://www.google.com", headless: bool = False) -> Dict[str, Any]:
    """Open a browser and navigate to a URL."""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    page = _browser_mgr.get_page(create_if_none=True, headless=headless)
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    title = page.title()
    current_url = page.url

    return {
        "status": "opened",
        "url": current_url,
        "title": title,
    }


def browser_navigate(url: str) -> Dict[str, Any]:
    """Navigate current browser tab to a specified URL."""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    page = _browser_mgr.get_page(create_if_none=True)
    page.goto(url, wait_until="domcontentloaded", timeout=30000)

    return {
        "url": page.url,
        "title": page.title(),
    }


def browser_screenshot(full_page: bool = False, output_path: Optional[str] = None) -> Dict[str, Any]:
    """Capture a screenshot of the current browser page."""
    page = _browser_mgr.get_page(create_if_none=False)
    if page is None:
        raise RuntimeError("No active browser page open. Call browser.open first.")

    if not output_path:
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, f"jarvis_browser_{os.getpid()}_{hash(page.url) & 0xFFFFFF}.png")

    page.screenshot(path=output_path, full_page=full_page)

    return {
        "file_path": output_path,
        "url": page.url,
        "title": page.title(),
        "full_page": full_page,
    }


def browser_get_content(extract_mode: str = "text", max_chars: int = 8000) -> Dict[str, Any]:
    """Extract readable text, markdown, links, or HTML from the current page."""
    page = _browser_mgr.get_page(create_if_none=False)
    if page is None:
        raise RuntimeError("No active browser page open. Call browser.open first.")

    html = page.content()

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # Remove scripts, styles, noscript, svg
        for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
            tag.decompose()

        if extract_mode == "links":
            links = []
            for a in soup.find_all("a", href=True):
                text = a.get_text(strip=True)
                href = a["href"]
                if text and href and not href.startswith("javascript:"):
                    links.append({"text": text[:60], "url": urllib.parse.urljoin(page.url, href)})
            return {
                "url": page.url,
                "title": page.title(),
                "links": links[:50],
            }

        text = soup.get_text(separator="\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text)
        truncated = len(text) > max_chars
        content = text[:max_chars]

        return {
            "url": page.url,
            "title": page.title(),
            "content": content,
            "truncated": truncated,
            "char_count": len(content),
        }
    except Exception:
        # Fallback to plain page text
        text = page.inner_text("body")[:max_chars]
        return {
            "url": page.url,
            "title": page.title(),
            "content": text,
            "truncated": len(text) >= max_chars,
        }


def browser_click(selector: str) -> Dict[str, Any]:
    """Click an element on the active page by CSS selector, text, or XPath."""
    page = _browser_mgr.get_page(create_if_none=False)
    if page is None:
        raise RuntimeError("No active browser page open. Call browser.open first.")

    page.click(selector, timeout=10000)
    page.wait_for_load_state("domcontentloaded", timeout=5000)

    return {
        "clicked": selector,
        "url": page.url,
        "title": page.title(),
    }


def browser_type(
    selector: str,
    text: str,
    press_enter: bool = False,
    clear_first: bool = True,
) -> Dict[str, Any]:
    """Type text into an input or textarea on the active page."""
    page = _browser_mgr.get_page(create_if_none=False)
    if page is None:
        raise RuntimeError("No active browser page open. Call browser.open first.")

    if clear_first:
        page.fill(selector, text, timeout=10000)
    else:
        page.type(selector, text, timeout=10000)

    if press_enter:
        page.press(selector, "Enter")
        page.wait_for_load_state("domcontentloaded", timeout=5000)

    return {
        "typed_into": selector,
        "text_length": len(text),
        "pressed_enter": press_enter,
        "url": page.url,
    }


def browser_scroll(direction: str = "down", amount: int = 600) -> Dict[str, Any]:
    """Scroll the active browser page."""
    page = _browser_mgr.get_page(create_if_none=False)
    if page is None:
        raise RuntimeError("No active browser page open. Call browser.open first.")

    if direction == "top":
        page.evaluate("window.scrollTo(0, 0)")
    elif direction == "bottom":
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    elif direction == "up":
        page.evaluate(f"window.scrollBy(0, -{amount})")
    else:
        page.evaluate(f"window.scrollBy(0, {amount})")

    scroll_y = page.evaluate("window.scrollY")

    return {
        "direction": direction,
        "amount": amount,
        "current_scroll_y": scroll_y,
    }


def browser_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Search the live web using Playwright or fast DuckDuckGo Lite engine."""
    results: List[Dict[str, str]] = []

    # Method 1: Fast HTTP DuckDuckGo Lite engine (works with zero browser binaries)
    try:
        import urllib.request
        import urllib.parse
        from bs4 import BeautifulSoup

        data = urllib.parse.urlencode({"q": query}).encode("utf-8")
        req = urllib.request.Request(
            "https://lite.duckduckgo.com/lite/",
            data=data,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://lite.duckduckgo.com/",
            },
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            html = response.read().decode("utf-8", errors="ignore")
            soup = BeautifulSoup(html, "html.parser")
            
            # Extract links and snippets from table rows
            link_tags = soup.select("a.result-link")
            snippet_tags = soup.select("td.result-snippet")

            for idx, a_tag in enumerate(link_tags):
                title = a_tag.get_text(strip=True)
                url = a_tag.get("href", "")
                snippet = snippet_tags[idx].get_text(strip=True) if idx < len(snippet_tags) else ""

                if title and url and url.startswith("http") and "duckduckgo.com" not in url:
                    results.append({"title": title, "url": url, "snippet": snippet})

                if len(results) >= max_results:
                    break
    except Exception as e:
        pass

    # Method 2: If HTTP search found nothing, try Playwright headless session
    if not results:
        try:
            encoded = urllib.parse.quote_plus(query)
            search_url = f"https://duckduckgo.com/?q={encoded}"
            page = _browser_mgr.get_page(create_if_none=True, headless=True)
            page.goto(search_url, wait_until="domcontentloaded", timeout=15000)

            try:
                page.wait_for_selector("article, [data-testid='result']", timeout=5000)
            except Exception:
                pass

            elements = page.query_selector_all("article, [data-testid='result'], .result")
            for el in elements:
                try:
                    link_tag = el.query_selector("a[data-testid='result-title-a'], h2 a, a.result__url")
                    snippet_tag = el.query_selector("[data-result='snippet'], .result__snippet, [data-testid='result-snippet']")
                    if link_tag:
                        title = link_tag.inner_text().strip()
                        url = link_tag.get_attribute("href") or ""
                        snippet = snippet_tag.inner_text().strip() if snippet_tag else ""
                        if title and url and url.startswith("http"):
                            results.append({"title": title, "url": url, "snippet": snippet})
                except Exception:
                    continue
                if len(results) >= max_results:
                    break
        except Exception:
            pass

    return {
        "query": query,
        "count": len(results),
        "results": results[:max_results],
        "message": f"Found {len(results)} live search result(s) for '{query}'." if results else f"No search results returned for '{query}'.",
    }


def browser_close() -> Dict[str, Any]:
    """Close the active browser session."""
    _browser_mgr.close()
    return {"status": "closed"}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def register_browser_tools(registry: ToolRegistry) -> None:
    """Register all web and browser automation tools into the registry."""

    registry.register(
        ToolDefinition(
            name="browser.open",
            description="Open a browser and navigate to a URL.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to navigate to", "default": "https://www.google.com"},
                    "headless": {"type": "boolean", "description": "Run in background without window", "default": False},
                },
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["browser:control"],
        ),
        browser_open,
    )

    registry.register(
        ToolDefinition(
            name="browser.navigate",
            description="Navigate the current active browser tab to a new URL.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to navigate to"},
                },
                "required": ["url"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["browser:control"],
        ),
        browser_navigate,
    )

    registry.register(
        ToolDefinition(
            name="browser.screenshot",
            description="Take a screenshot of the active browser webpage.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "full_page": {"type": "boolean", "description": "Capture full scrollable page", "default": False},
                    "output_path": {"type": "string", "description": "Custom file path to save image"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["browser:control"],
        ),
        browser_screenshot,
    )

    registry.register(
        ToolDefinition(
            name="browser.get_content",
            description="Extract cleaned text, links, or content from the current active browser page.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "extract_mode": {
                        "type": "string",
                        "enum": ["text", "links", "markdown"],
                        "default": "text",
                        "description": "Extraction mode",
                    },
                    "max_chars": {"type": "integer", "default": 8000, "description": "Maximum characters to return"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["browser:control"],
        ),
        browser_get_content,
    )

    registry.register(
        ToolDefinition(
            name="browser.click",
            description="Click an element on the active browser webpage by CSS selector, text or XPath.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector or text selector (e.g. 'text=Search')"},
                },
                "required": ["selector"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["browser:control"],
        ),
        browser_click,
    )

    registry.register(
        ToolDefinition(
            name="browser.type",
            description="Type text into an input field or textarea on the active webpage.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector for the input element"},
                    "text": {"type": "string", "description": "Text to type"},
                    "press_enter": {"type": "boolean", "default": False, "description": "Press Enter after typing"},
                    "clear_first": {"type": "boolean", "default": True, "description": "Clear field before typing"},
                },
                "required": ["selector", "text"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["browser:control"],
        ),
        browser_type,
    )

    registry.register(
        ToolDefinition(
            name="browser.scroll",
            description="Scroll the active browser window up, down, to top, or to bottom.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["down", "up", "top", "bottom"],
                        "default": "down",
                        "description": "Scroll direction",
                    },
                    "amount": {"type": "integer", "default": 600, "description": "Pixel amount to scroll"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["browser:control"],
        ),
        browser_scroll,
    )

    registry.register(
        ToolDefinition(
            name="browser.search",
            description="Search the web (DuckDuckGo) and return top search results with titles, snippets, and URLs.",
            category="browser",
            arguments_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query keywords"},
                    "max_results": {"type": "integer", "default": 5, "description": "Number of results to return"},
                },
                "required": ["query"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["browser:control"],
        ),
        browser_search,
    )

    registry.register(
        ToolDefinition(
            name="browser.close",
            description="Close the active browser session and clean up resources.",
            category="browser",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["browser:control"],
        ),
        browser_close,
    )
