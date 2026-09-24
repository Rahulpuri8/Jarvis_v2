"""
Git Tool Suite for BuildOS AI / JARVIS Runtime
Provides repository status inspection, diff viewing, commit log, and approval-gated commits.
"""

import os
import subprocess
from typing import Any, Dict, List, Optional
from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry, default_registry


def run_git_command(args: List[str], cwd: Optional[str] = None) -> Dict[str, Any]:
    """Execute a git CLI command safely within target workspace directory."""
    work_dir = cwd or os.getcwd()
    try:
        res = subprocess.run(
            ["git"] + args,
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return {
            "success": res.returncode == 0,
            "exit_code": res.returncode,
            "stdout": res.stdout.strip(),
            "stderr": res.stderr.strip(),
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Failed to run git command: {str(e)}",
        }


def git_status(repo_path: Optional[str] = None) -> Dict[str, Any]:
    """Check current git repository status (branch, modified files, untracked files)."""
    res = run_git_command(["status", "--porcelain=v2", "--branch"], cwd=repo_path)
    if not res["success"]:
        return {"success": False, "error": res["stderr"] or "Not a git repository."}

    lines = res["stdout"].splitlines()
    branch = "unknown"
    modified = []
    untracked = []

    for line in lines:
        if line.startswith("# branch.head "):
            branch = line.split("# branch.head ")[1].strip()
        elif line.startswith("1 ") or line.startswith("2 "):
            parts = line.split()
            if len(parts) >= 9:
                modified.append(parts[-1])
        elif line.startswith("? "):
            untracked.append(line.split("? ")[1].strip())

    return {
        "success": True,
        "branch": branch,
        "modified_files": modified,
        "untracked_files": untracked,
        "total_changes": len(modified) + len(untracked),
        "raw_status": res["stdout"],
    }


def git_diff(repo_path: Optional[str] = None, staged: bool = False) -> Dict[str, Any]:
    """Inspect git diff for unstaged or staged changes."""
    args = ["diff", "--staged"] if staged else ["diff"]
    res = run_git_command(args, cwd=repo_path)
    return {
        "success": res["success"],
        "staged": staged,
        "diff": res["stdout"],
        "error": res["stderr"] if not res["success"] else None,
    }


def git_log(repo_path: Optional[str] = None, limit: int = 5) -> Dict[str, Any]:
    """Get recent commit history."""
    res = run_git_command(["log", f"-n{limit}", "--pretty=format:%h - %an, %ar : %s"], cwd=repo_path)
    commits = res["stdout"].splitlines() if res["success"] else []
    return {
        "success": res["success"],
        "commits": commits,
        "error": res["stderr"] if not res["success"] else None,
    }


def git_commit(message: str, repo_path: Optional[str] = None) -> Dict[str, Any]:
    """Create a git commit with the given commit message."""
    if not message.strip():
        return {"success": False, "error": "Commit message cannot be empty."}

    res = run_git_command(["commit", "-m", message], cwd=repo_path)
    return {
        "success": res["success"],
        "message": res["stdout"] if res["success"] else res["stderr"],
        "error": res["stderr"] if not res["success"] else None,
    }


def register_git_tools(registry: ToolRegistry = default_registry) -> None:
    registry.register(
        ToolDefinition(
            name="git.status",
            description="Check current git repository branch and change status.",
            category="git",
            arguments_schema={
                "type": "object",
                "properties": {
                    "repo_path": {"type": "string", "description": "Optional repository path"}
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["git:read"],
        ),
        git_status,
    )

    registry.register(
        ToolDefinition(
            name="git.diff",
            description="Inspect git file changes and line diffs.",
            category="git",
            arguments_schema={
                "type": "object",
                "properties": {
                    "repo_path": {"type": "string", "description": "Optional repository path"},
                    "staged": {"type": "boolean", "description": "Inspect staged changes if true"}
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["git:read"],
        ),
        git_diff,
    )

    registry.register(
        ToolDefinition(
            name="git.log",
            description="View recent git commit log history.",
            category="git",
            arguments_schema={
                "type": "object",
                "properties": {
                    "repo_path": {"type": "string"},
                    "limit": {"type": "integer", "default": 5}
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["git:read"],
        ),
        git_log,
    )

    registry.register(
        ToolDefinition(
            name="git.commit",
            description="Create a new git commit with a message (requires approval).",
            category="git",
            arguments_schema={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Commit message"},
                    "repo_path": {"type": "string"}
                },
                "required": ["message"],
            },
            risk_level=ToolRiskLevel.EXTERNAL_WRITE,
            permissions=["git:write"],
            side_effects=True,
        ),
        git_commit,
    )
