from __future__ import annotations
from enum import IntEnum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import time
import uuid


class ToolRiskLevel(IntEnum):
    """
    Risk classification for tools:
    0: Read-only, informational, non-destructive (e.g. system info, screenshot)
    1: Low risk, local desktop action (e.g. open app, focus window, set volume)
    2: External write, communication, or potentially mutating (e.g. send email, delete file)
    3: High risk / financial / destructive (e.g. shell command, money transfer, system shutdown)
    """
    READ_ONLY = 0
    LOW_RISK = 1
    EXTERNAL_WRITE = 2
    CRITICAL_FINANCIAL = 3


class ToolDefinition(BaseModel):
    """Metadata describing a registered tool capability."""
    name: str = Field(..., description="Unique tool identifier, e.g., 'desktop.open_app'")
    description: str = Field(..., description="Human-readable description of what the tool does")
    category: str = Field(default="general", description="Category grouping, e.g., 'desktop', 'system', 'files'")
    arguments_schema: Dict[str, Any] = Field(default_factory=dict, description="JSON Schema for tool arguments")
    risk_level: ToolRiskLevel = Field(default=ToolRiskLevel.READ_ONLY, description="Risk level (0-3)")
    permissions: List[str] = Field(default_factory=list, description="Required permission capabilities")
    timeout: int = Field(default=30, description="Execution timeout in seconds")
    supports_undo: bool = Field(default=False, description="Whether an undo operation is supported")
    side_effects: bool = Field(default=False, description="Whether running this alters external state")


class ToolRequest(BaseModel):
    """Incoming request to execute a tool."""
    tool: str = Field(..., description="Tool name to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments dictionary")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Tracking request UUID")


class ToolResult(BaseModel):
    """Standardized response from tool execution."""
    success: bool
    status: str = Field(..., description="'completed' | 'failed' | 'rejected' | 'pending_approval'")
    data: Optional[Dict[str, Any]] = None
    message: str
    error: Optional[str] = None
    retryable: bool = False
    request_id: str
    duration_ms: float = 0.0
    timestamp: float = Field(default_factory=time.time)


class ToolAuditEntry(BaseModel):
    """Audit log record for tool invocations."""
    request_id: str
    tool: str
    arguments: Dict[str, Any]
    risk_level: int
    status: str
    duration_ms: float
    timestamp: float = Field(default_factory=time.time)
    error: Optional[str] = None
