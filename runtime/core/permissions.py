from typing import List, Set
from .models import ToolDefinition, ToolRiskLevel


class PermissionManager:
    """
    Manages permission evaluation and risk checking for tool execution.
    """

    def __init__(self, granted_permissions: List[str] | None = None, max_auto_risk: ToolRiskLevel = ToolRiskLevel.LOW_RISK):
        # Default granted permissions for the local desktop agent
        self.granted_permissions: Set[str] = set(granted_permissions or [
            "desktop:read",
            "desktop:control",
            "system:read",
            "system:notify",
            "files:read",
            "files:write",
            "browser:read",
            "browser:control",
            "scheduler:manage",
            "email:read",
            "email:send",
            "calendar:read",
            "calendar:manage",
            "memory:read",
            "memory:write",
            "voice:speak",
            "voice:listen",
            "vision:read",
        ])
        self.max_auto_risk = max_auto_risk

    def grant(self, permission: str) -> None:
        self.granted_permissions.add(permission)

    def revoke(self, permission: str) -> None:
        self.granted_permissions.discard(permission)

    def has_permission(self, permission: str) -> bool:
        if "*" in self.granted_permissions:
            return True
        if permission in self.granted_permissions:
            return True
        # Check wildcard prefixes e.g. "desktop:*"
        parts = permission.split(":")
        if len(parts) == 2 and f"{parts[0]}:*" in self.granted_permissions:
            return True
        return False

    def can_execute(self, tool_def: ToolDefinition) -> tuple[bool, str]:
        """
        Check if the tool meets permission requirements.
        Returns (allowed, reason).
        """
        for perm in tool_def.permissions:
            if not self.has_permission(perm):
                return False, f"Missing required permission: '{perm}'"

        if tool_def.risk_level > self.max_auto_risk:
            return False, f"Tool risk level {tool_def.risk_level.name} exceeds auto-execution limit ({self.max_auto_risk.name}); requires user approval"

        return True, "Authorized"
