import asyncio
import inspect
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional
from .models import ToolAuditEntry, ToolDefinition, ToolRequest, ToolResult, ToolRiskLevel
from .permissions import PermissionManager
from .registry import ToolRegistry, default_registry


class ToolGateway:
    """
    Central execution gateway enforcing validation, permissions, timeouts, and auditing.
    """

    def __init__(
        self,
        registry: ToolRegistry = default_registry,
        permission_manager: Optional[PermissionManager] = None,
    ) -> None:
        self.registry = registry
        self.permission_manager = permission_manager or PermissionManager()
        self.audit_log: List[ToolAuditEntry] = []
        # Playwright's sync API is thread-affine. Keep the browser session on one worker.
        self.browser_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="jarvis-browser")

    async def execute(self, request: ToolRequest) -> ToolResult:
        """
        Execute a tool request through the validation and security pipeline.
        """
        start_time = time.perf_counter()
        tool_entry = self.registry.get(request.tool)

        if not tool_entry:
            duration_ms = (time.perf_counter() - start_time) * 1000
            err_msg = f"Tool '{request.tool}' is not registered."
            self._log_audit(request, ToolRiskLevel.READ_ONLY, "failed", duration_ms, error=err_msg)
            return ToolResult(
                success=False,
                status="failed",
                message=err_msg,
                error=err_msg,
                retryable=False,
                request_id=request.request_id,
                duration_ms=duration_ms,
            )

        tool_def, handler = tool_entry

        # Permission & Risk check
        allowed, reason = self.permission_manager.can_execute(tool_def)
        if not allowed:
            duration_ms = (time.perf_counter() - start_time) * 1000
            status = "pending_approval" if "requires user approval" in reason else "rejected"
            self._log_audit(request, tool_def.risk_level, status, duration_ms, error=reason)
            return ToolResult(
                success=False,
                status=status,
                message=reason,
                error=reason,
                retryable=False,
                request_id=request.request_id,
                duration_ms=duration_ms,
            )

        # Execution with timeout
        try:
            # Check if handler accepts arguments as kwargs or single dict
            sig = inspect.signature(handler)
            is_async = inspect.iscoroutinefunction(handler)

            if is_async:
                if len(sig.parameters) == 0:
                    coro = handler()
                elif len(sig.parameters) == 1 and ("args" in sig.parameters or "arguments" in sig.parameters or "payload" in sig.parameters):
                    coro = handler(request.arguments)
                else:
                    coro = handler(**request.arguments)
                result_data = await asyncio.wait_for(coro, timeout=tool_def.timeout)
            else:
                def sync_call():
                    if len(sig.parameters) == 0:
                        return handler()
                    elif len(sig.parameters) == 1 and ("args" in sig.parameters or "arguments" in sig.parameters or "payload" in sig.parameters):
                        return handler(request.arguments)
                    else:
                        return handler(**request.arguments)

                loop = asyncio.get_running_loop()
                result_data = await asyncio.wait_for(
                    loop.run_in_executor(self.browser_executor if request.tool.startswith("browser.") else None, sync_call),
                    timeout=tool_def.timeout,
                )

            duration_ms = (time.perf_counter() - start_time) * 1000

            # Normalize result data
            if isinstance(result_data, dict):
                data = result_data
                msg = result_data.get("message", f"Tool '{request.tool}' executed successfully.")
            else:
                data = {"result": result_data}
                msg = f"Tool '{request.tool}' executed successfully."

            self._log_audit(request, tool_def.risk_level, "completed", duration_ms)
            return ToolResult(
                success=True,
                status="completed",
                data=data,
                message=msg,
                error=None,
                request_id=request.request_id,
                duration_ms=duration_ms,
            )

        except asyncio.TimeoutError:
            duration_ms = (time.perf_counter() - start_time) * 1000
            err_msg = f"Tool execution timed out after {tool_def.timeout}s."
            self._log_audit(request, tool_def.risk_level, "failed", duration_ms, error=err_msg)
            return ToolResult(
                success=False,
                status="failed",
                message=err_msg,
                error=err_msg,
                retryable=True,
                request_id=request.request_id,
                duration_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            err_msg = f"Error during tool execution: {str(e)}"
            self._log_audit(request, tool_def.risk_level, "failed", duration_ms, error=err_msg)
            return ToolResult(
                success=False,
                status="failed",
                message=err_msg,
                error=err_msg,
                retryable=False,
                request_id=request.request_id,
                duration_ms=duration_ms,
            )

    def _log_audit(
        self,
        request: ToolRequest,
        risk_level: int,
        status: str,
        duration_ms: float,
        error: Optional[str] = None,
    ) -> None:
        self.audit_log.append(
            ToolAuditEntry(
                request_id=request.request_id,
                tool=request.tool,
                arguments=request.arguments,
                risk_level=int(risk_level),
                status=status,
                duration_ms=duration_ms,
                error=error,
            )
        )
