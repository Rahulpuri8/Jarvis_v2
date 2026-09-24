import pytest
import os
from runtime.tools.git import git_status, git_diff, git_log, git_commit, register_git_tools
from runtime.core.registry import ToolRegistry


def test_git_tools_execution():
    # Run status in current workspace repo
    status_res = git_status()
    assert "success" in status_res
    if status_res["success"]:
        assert "branch" in status_res
        assert "modified_files" in status_res

    # Run diff
    diff_res = git_diff(staged=False)
    assert "success" in diff_res

    # Run log
    log_res = git_log(limit=3)
    assert "success" in log_res
    if log_res["success"]:
        assert "commits" in log_res


def test_git_tools_registration():
    reg = ToolRegistry()
    register_git_tools(reg)
    assert reg.get("git.status") is not None
    assert reg.get("git.diff") is not None
    assert reg.get("git.log") is not None
    assert reg.get("git.commit") is not None
