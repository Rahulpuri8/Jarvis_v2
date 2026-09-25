import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import sys
from pathlib import Path

# Add project root to sys.path if executed directly as a script
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

if __package__ is None or __package__ == "":
    from runtime.core.models import ToolDefinition, ToolRequest, ToolResult
    from runtime.core.registry import default_registry
    from runtime.core.gateway import ToolGateway
    from runtime.tools import register_all_tools
else:
    from .core.models import ToolDefinition, ToolRequest, ToolResult
    from .core.registry import default_registry
    from .core.gateway import ToolGateway
    from .tools import register_all_tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("jarvis.runtime")

# Initialize registry, gateway, and tools
register_all_tools(default_registry)
gateway = ToolGateway(registry=default_registry)
start_time = time.time()

app = FastAPI(
    title="JARVIS Python Tool Runtime",
    description="Tool execution sidecar for JARVIS / BuildOS AI Desktop Agent",
    version="0.1.0",
)

# Enable CORS for local Electron/Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    uptime = time.time() - start_time
    health = default_registry.health_check()
    health["uptime_seconds"] = round(uptime, 2)
    health["version"] = "0.1.0"
    return health


@app.get("/tools", response_model=List[ToolDefinition])
async def list_tools(category: Optional[str] = Query(None, description="Optional category filter")) -> List[ToolDefinition]:
    """List all available registered tools."""
    return default_registry.list_tools(category=category)


@app.post("/execute", response_model=ToolResult)
async def execute_tool(request: ToolRequest) -> ToolResult:
    """Execute a tool via HTTP POST (fallback to WebSocket)."""
    logger.info(f"HTTP Execute tool request: {request.tool} (id: {request.request_id})")
    result = await gateway.execute(request)
    return result


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for bidirectional real-time tool execution.
    """
    await websocket.accept()
    logger.info("WebSocket client connected to JARVIS runtime.")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
                tool_name = data.get("tool")
                arguments = data.get("arguments", {})
                req_id = data.get("request_id")

                if not tool_name:
                    err_res = {
                        "success": False,
                        "status": "failed",
                        "message": "Missing 'tool' field in request.",
                        "error": "Missing 'tool' field.",
                        "request_id": req_id or "unknown",
                    }
                    await websocket.send_text(json.dumps(err_res))
                    continue

                req = ToolRequest(tool=tool_name, arguments=arguments)
                if req_id:
                    req.request_id = req_id

                logger.info(f"WS Execute: {req.tool} (id: {req.request_id})")
                res = await gateway.execute(req)
                await websocket.send_text(res.model_dump_json())

            except json.JSONDecodeError:
                err_res = {
                    "success": False,
                    "status": "failed",
                    "message": "Invalid JSON format.",
                    "error": "JSONDecodeError",
                    "request_id": "unknown",
                }
                await websocket.send_text(json.dumps(err_res))
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}", exc_info=True)
                err_res = {
                    "success": False,
                    "status": "failed",
                    "message": f"Server error: {str(e)}",
                    "error": str(e),
                    "request_id": "unknown",
                }
                await websocket.send_text(json.dumps(err_res))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9321, log_level="info")
