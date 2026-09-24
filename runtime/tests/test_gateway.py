import pytest
import asyncio
from runtime.core.models import ToolDefinition, ToolRequest, ToolRiskLevel
from runtime.core.registry import ToolRegistry
from runtime.core.gateway import ToolGateway
from runtime.core.permissions import PermissionManager


@pytest.mark.asyncio
async def test_gateway_successful_execution():
    reg = ToolRegistry()
    t_def = ToolDefinition(
        name="math.add",
        description="Add two numbers",
        category="math",
        risk_level=ToolRiskLevel.READ_ONLY,
        permissions=["system:read"],
    )

    def add(a: int, b: int):
        return {"sum": a + b}

    reg.register(t_def, add)

    perm_mgr = PermissionManager(granted_permissions=["system:read"])
    gateway = ToolGateway(registry=reg, permission_manager=perm_mgr)

    req = ToolRequest(tool="math.add", arguments={"a": 5, "b": 7})
    res = await gateway.execute(req)

    assert res.success is True
    assert res.status == "completed"
    assert res.data == {"sum": 12}
    assert res.error is None
    assert len(gateway.audit_log) == 1


@pytest.mark.asyncio
async def test_gateway_missing_tool():
    reg = ToolRegistry()
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="unknown.tool", arguments={})
    res = await gateway.execute(req)

    assert res.success is False
    assert res.status == "failed"
    assert "not registered" in res.message


@pytest.mark.asyncio
async def test_gateway_permission_denied():
    reg = ToolRegistry()
    t_def = ToolDefinition(
        name="secret.tool",
        description="Requires special permission",
        risk_level=ToolRiskLevel.READ_ONLY,
        permissions=["secret:access"],
    )
    reg.register(t_def, lambda: {"secret": 123})

    perm_mgr = PermissionManager(granted_permissions=["other:access"])
    gateway = ToolGateway(registry=reg, permission_manager=perm_mgr)

    req = ToolRequest(tool="secret.tool", arguments={})
    res = await gateway.execute(req)

    assert res.success is False
    assert res.status == "rejected"
    assert "Missing required permission" in res.message


@pytest.mark.asyncio
async def test_gateway_high_risk_pending_approval():
    reg = ToolRegistry()
    t_def = ToolDefinition(
        name="danger.tool",
        description="High risk tool",
        risk_level=ToolRiskLevel.EXTERNAL_WRITE,
        permissions=["system:read"],
    )
    reg.register(t_def, lambda: {"danger": True})

    perm_mgr = PermissionManager(
        granted_permissions=["system:read"],
        max_auto_risk=ToolRiskLevel.LOW_RISK,
    )
    gateway = ToolGateway(registry=reg, permission_manager=perm_mgr)

    req = ToolRequest(tool="danger.tool", arguments={})
    res = await gateway.execute(req)

    assert res.success is False
    assert res.status == "pending_approval"
    assert "requires user approval" in res.message
