import os
import glob
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry


def _sanitize_path(p: str) -> str:
    return os.path.abspath(os.path.expanduser(os.path.expandvars(p)))


def file_search(directory: str, pattern: str, max_results: int = 50) -> Dict[str, Any]:
    """Search for files matching a glob pattern within a directory."""
    clean_dir = _sanitize_path(directory)
    if not os.path.exists(clean_dir):
        raise FileNotFoundError(f"Directory '{directory}' does not exist.")

    search_path = os.path.join(clean_dir, "**", pattern)
    matches = glob.glob(search_path, recursive=True)
    results = []

    for path_str in matches[:max_results]:
        p = Path(path_str)
        try:
            stat = p.stat()
            results.append({
                "path": str(p),
                "name": p.name,
                "is_dir": p.is_dir(),
                "size_bytes": stat.st_size if not p.is_dir() else 0,
                "modified": stat.st_mtime,
            })
        except (PermissionError, FileNotFoundError):
            continue

    return {
        "count": len(results),
        "total_matched": len(matches),
        "files": results,
        "message": f"Found {len(matches)} item(s) matching '{pattern}' in '{directory}'",
    }


def file_info(file_path: str) -> Dict[str, Any]:
    """Get metadata about a specific file or folder."""
    clean_path = _sanitize_path(file_path)
    p = Path(clean_path)
    if not p.exists():
        raise FileNotFoundError(f"Path '{file_path}' does not exist.")

    stat = p.stat()
    return {
        "path": str(p),
        "name": p.name,
        "extension": p.suffix,
        "is_dir": p.is_dir(),
        "is_file": p.is_file(),
        "size_bytes": stat.st_size,
        "created": stat.st_ctime,
        "modified": stat.st_mtime,
        "message": f"File info for '{p.name}': {stat.st_size} bytes",
    }


def list_dir(directory: str) -> Dict[str, Any]:
    """List direct children in a directory."""
    clean_dir = _sanitize_path(directory)
    p = Path(clean_dir)
    if not p.exists() or not p.is_dir():
        raise NotADirectoryError(f"Directory '{directory}' does not exist.")

    items = []
    for child in p.iterdir():
        try:
            stat = child.stat()
            items.append({
                "name": child.name,
                "path": str(child),
                "is_dir": child.is_dir(),
                "size_bytes": stat.st_size if child.is_file() else 0,
            })
        except (PermissionError, FileNotFoundError):
            continue

    folders = [item["name"] for item in items if item["is_dir"]]
    files = [item["name"] for item in items if not item["is_dir"]]

    return {
        "directory": clean_dir,
        "total_items": len(items),
        "total_folders": len(folders),
        "total_files": len(files),
        "folders": folders,
        "files": files,
        "items": items,
        "message": f"Found {len(folders)} folders and {len(files)} files in '{clean_dir}'.",
    }


def read_text(file_path: Optional[str] = None, max_chars: int = 50000, path: Optional[str] = None) -> Dict[str, Any]:
    """Read contents of a text file."""
    target_path = file_path or path
    if not target_path:
        raise ValueError("Must provide either 'file_path' or 'path'.")

    clean_path = _sanitize_path(target_path)
    p = Path(clean_path)
    if not p.is_file():
        raise FileNotFoundError(f"File '{target_path}' not found.")

    content = p.read_text(encoding="utf-8", errors="replace")
    truncated = len(content) > max_chars
    return {
        "file_path": str(p),
        "content": content[:max_chars],
        "total_chars": len(content),
        "truncated": truncated,
        "message": f"Read {min(len(content), max_chars)} characters from '{p.name}'",
    }


def write_text(file_path: Optional[str] = None, content: str = "", overwrite: bool = True, path: Optional[str] = None) -> Dict[str, Any]:
    """Write text to a file."""
    target_path = file_path or path
    if not target_path:
        raise ValueError("Must provide either 'file_path' or 'path'.")

    clean_path = _sanitize_path(target_path)
    p = Path(clean_path)

    if p.exists() and not overwrite:
        raise FileExistsError(f"File '{target_path}' already exists and overwrite is False.")

    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")

    return {
        "saved": True,
        "file_path": str(p),
        "size_bytes": len(content.encode("utf-8")),
        "message": f"Successfully wrote to '{p.name}'",
    }


def register_file_tools(registry: ToolRegistry) -> None:
    """Register file inspection and management tools."""
    registry.register(
        ToolDefinition(
            name="files.search",
            description="Search for files matching a pattern inside a folder",
            category="files",
            arguments_schema={
                "type": "object",
                "properties": {
                    "directory": {"type": "string", "description": "Root directory path to search"},
                    "pattern": {"type": "string", "description": "Glob pattern, e.g., '*.pdf', '*report*'"},
                    "max_results": {"type": "integer", "default": 50},
                },
                "required": ["directory", "pattern"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        file_search,
    )

    registry.register(
        ToolDefinition(
            name="files.info",
            description="Get metadata and size of a file or folder",
            category="files",
            arguments_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Absolute or relative file path"},
                },
                "required": ["file_path"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        file_info,
    )

    registry.register(
        ToolDefinition(
            name="files.list_dir",
            description="List items inside a directory",
            category="files",
            arguments_schema={
                "type": "object",
                "properties": {
                    "directory": {"type": "string", "description": "Directory path to list"},
                },
                "required": ["directory"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        list_dir,
    )

    registry.register(
        ToolDefinition(
            name="files.read_text",
            description="Read text contents of a file",
            category="files",
            arguments_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to text file"},
                    "max_chars": {"type": "integer", "default": 50000},
                },
                "required": ["file_path"],
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        read_text,
    )

    registry.register(
        ToolDefinition(
            name="files.write_text",
            description="Write text contents to a file (creates parent folders if needed)",
            category="files",
            arguments_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Destination file path"},
                    "content": {"type": "string", "description": "Text content to write"},
                    "overwrite": {"type": "boolean", "default": True},
                },
                "required": ["file_path", "content"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["files:write"],
            side_effects=True,
        ),
        write_text,
    )

    # Shorthand aliases
    registry.register(
        ToolDefinition(
            name="files.read",
            description="Read text contents of a file (shorthand alias for files.read_text)",
            category="files",
            arguments_schema={"type": "object", "properties": {"file_path": {"type": "string"}}, "required": ["file_path"]},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        read_text,
    )

    registry.register(
        ToolDefinition(
            name="files.write",
            description="Write text contents to a file (shorthand alias for files.write_text)",
            category="files",
            arguments_schema={"type": "object", "properties": {"file_path": {"type": "string"}, "content": {"type": "string"}}, "required": ["file_path", "content"]},
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["files:write"],
            side_effects=True,
        ),
        write_text,
    )

    registry.register(
        ToolDefinition(
            name="files.list",
            description="List directory items (shorthand alias for files.list_dir)",
            category="files",
            arguments_schema={"type": "object", "properties": {"directory": {"type": "string"}}, "required": ["directory"]},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["files:read"],
        ),
        list_dir,
    )

    registry.register(
        ToolDefinition(
            name="files.delete",
            description="Permanently delete a file or directory after explicit confirmation",
            category="files",
            arguments_schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
            risk_level=ToolRiskLevel.CRITICAL_FINANCIAL,
            permissions=["files:write"],
            side_effects=True,
        ),
        delete_file_or_dir,
    )


def delete_file_or_dir(path: str) -> Dict[str, Any]:
    """Permanently delete a file or directory."""
    import shutil
    clean_p = _sanitize_path(path)
    if not os.path.exists(clean_p):
        raise FileNotFoundError(f"Path '{path}' does not exist.")
    if os.path.isdir(clean_p):
        shutil.rmtree(clean_p)
        return {"deleted": True, "path": clean_p, "is_dir": True, "message": f"Successfully deleted directory '{clean_p}'"}
    else:
        os.remove(clean_p)
        return {"deleted": True, "path": clean_p, "is_dir": False, "message": f"Successfully deleted file '{clean_p}'"}


