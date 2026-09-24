from ..core.registry import ToolRegistry, default_registry
from .desktop import register_desktop_tools
from .system import register_system_tools
from .files import register_file_tools
from .browser import register_browser_tools
from .scheduler import register_scheduler_tools
from .email import register_email_tools
from .calendar import register_calendar_tools
from .memory import register_memory_tools
from .voice import register_voice_tools
from .vision import register_vision_tools
from .git import register_git_tools


def register_all_tools(registry: ToolRegistry = default_registry) -> None:
    """Register all available tool suites into the given registry."""
    register_desktop_tools(registry)
    register_system_tools(registry)
    register_file_tools(registry)
    register_browser_tools(registry)
    register_scheduler_tools(registry)
    register_email_tools(registry)
    register_calendar_tools(registry)
    register_memory_tools(registry)
    register_voice_tools(registry)
    register_vision_tools(registry)
    register_git_tools(registry)


__all__ = [
    "register_all_tools",
    "register_desktop_tools",
    "register_system_tools",
    "register_file_tools",
    "register_browser_tools",
    "register_scheduler_tools",
    "register_email_tools",
    "register_calendar_tools",
    "register_memory_tools",
    "register_voice_tools",
    "register_vision_tools",
    "register_git_tools",
]
