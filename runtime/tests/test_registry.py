import pytest
from runtime.core.models import ToolDefinition, ToolRiskLevel
from runtime.core.registry import ToolRegistry


def test_registry_register_and_get():
    reg = ToolRegistry()
    tool_def = ToolDefinition(
        name="test.echo",
        description="Echo input text",
        category="test",
        arguments_schema={"type": "object", "properties": {"msg": {"type": "string"}}},
        risk_level=ToolRiskLevel.READ_ONLY,
    )

    def echo_handler(msg: str):
        return {"echo": msg}

    reg.register(tool_def, echo_handler)

    entry = reg.get("test.echo")
    assert entry is not None
    fetched_def, handler = entry
    assert fetched_def.name == "test.echo"
    assert handler("hello") == {"echo": "hello"}


def test_registry_duplicate_error():
    reg = ToolRegistry()
    tool_def = ToolDefinition(
        name="test.dup",
        description="Duplicate test",
        category="test",
    )
    reg.register(tool_def, lambda: None)
    with pytest.raises(ValueError):
        reg.register(tool_def, lambda: None)


def test_registry_list_and_health():
    reg = ToolRegistry()
    t1 = ToolDefinition(name="cat1.tool", description="T1", category="cat1")
    t2 = ToolDefinition(name="cat2.tool", description="T2", category="cat2")
    reg.register(t1, lambda: None)
    reg.register(t2, lambda: None)

    assert len(reg.list_tools()) == 2
    assert len(reg.list_tools(category="cat1")) == 1
    health = reg.health_check()
    assert health["total_tools"] == 2
    assert "cat1" in health["categories"]
