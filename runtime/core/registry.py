from typing import Any, Callable, Dict, List, Optional, Tuple
import inspect
from .models import ToolDefinition


ToolHandler = Callable[..., Any]


class ToolRegistry:
    """
    Central repository for all available tools and their handlers.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, ToolDefinition] = {}
        self._handlers: Dict[str, ToolHandler] = {}

    def register(self, definition: ToolDefinition, handler: ToolHandler) -> None:
        """Register a tool definition and its executing function."""
        if definition.name in self._tools:
            raise ValueError(f"Tool '{definition.name}' is already registered.")
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler

    def unregister(self, name: str) -> None:
        """Unregister a tool."""
        self._tools.pop(name, None)
        self._handlers.pop(name, None)

    def get(self, name: str) -> Optional[Tuple[ToolDefinition, ToolHandler]]:
        """Retrieve tool definition and handler by tool name."""
        if name not in self._tools:
            return None
        return self._tools[name], self._handlers[name]

    def get_definition(self, name: str) -> Optional[ToolDefinition]:
        """Get only the definition metadata of a tool."""
        return self._tools.get(name)

    def list_tools(self, category: Optional[str] = None) -> List[ToolDefinition]:
        """List registered tool definitions, optionally filtered by category."""
        if category:
            return [t for t in self._tools.values() if t.category == category]
        return list(self._tools.values())

    def health_check(self) -> Dict[str, Any]:
        """Return registry health status and count of registered tools."""
        return {
            "status": "healthy",
            "total_tools": len(self._tools),
            "categories": list({t.category for t in self._tools.values()}),
            "tools": list(self._tools.keys()),
        }


# Global default registry instance
default_registry = ToolRegistry()
