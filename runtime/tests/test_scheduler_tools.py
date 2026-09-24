import pytest
from runtime.core.gateway import ToolGateway
from runtime.core.models import ToolRequest
from runtime.core.registry import ToolRegistry
from runtime.tools.scheduler import (
    register_scheduler_tools,
    create_timer,
    create_cron,
    list_jobs,
    cancel_job,
)


def test_scheduler_tools_registration():
    reg = ToolRegistry()
    register_scheduler_tools(reg)

    tools = reg.list_tools()
    tool_names = [t.name for t in tools]

    expected = [
        "scheduler.create_timer",
        "scheduler.create_cron",
        "scheduler.list_jobs",
        "scheduler.cancel_job",
    ]

    for name in expected:
        assert name in tool_names, f"Expected {name} to be registered"
        defn, handler = reg.get(name)
        assert defn is not None
        assert defn.category == "scheduler"
        assert callable(handler)


def test_create_and_cancel_timer():
    res = create_timer(delay_seconds=120, message="Test reminder notification")
    assert res["status"] == "scheduled"
    assert "job_id" in res
    assert res["delay_seconds"] == 120

    job_id = res["job_id"]

    # Verify in list
    jobs_res = list_jobs()
    assert any(j["id"] == job_id for j in jobs_res["jobs"])

    # Cancel
    cancel_res = cancel_job(job_id)
    assert cancel_res["canceled"] is True


def test_create_cron():
    res = create_cron(job_name="Daily Health Audit", interval_seconds=3600)
    assert res["status"] == "active"
    assert "job_id" in res

    cancel_job(res["job_id"])


@pytest.mark.asyncio
async def test_gateway_scheduler_dispatch():
    reg = ToolRegistry()
    register_scheduler_tools(reg)
    gateway = ToolGateway(registry=reg)

    req = ToolRequest(tool="scheduler.list_jobs", arguments={})
    res = await gateway.execute(req)

    assert res.success is True
    assert res.status == "completed"
    assert "total_jobs" in res.data
