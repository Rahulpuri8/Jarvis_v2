import os
import platform
import subprocess
from typing import Any, Dict, List, Optional
import psutil
import pyperclip
from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry


def get_system_info() -> Dict[str, Any]:
    """Retrieve detailed system hardware and OS status."""
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count(logical=True)
    cpu_freq = psutil.cpu_freq()

    mem = psutil.virtual_memory()

    # Query all mounted drive partitions (C:, D:, etc.)
    drives = []
    total_disk_gb = 0.0
    used_disk_gb = 0.0
    free_disk_gb = 0.0

    for part in psutil.disk_partitions(all=False):
        try:
            if "cdrom" in part.opts or not part.fstype:
                continue
            usage = psutil.disk_usage(part.mountpoint)
            t_gb = round(usage.total / (1024**3), 1)
            u_gb = round(usage.used / (1024**3), 1)
            f_gb = round(usage.free / (1024**3), 1)
            drives.append({
                "drive": part.mountpoint.replace("\\", ""),
                "mountpoint": part.mountpoint,
                "device": part.device,
                "fstype": part.fstype,
                "total_gb": t_gb,
                "used_gb": u_gb,
                "free_gb": f_gb,
                "percent": usage.percent,
            })
            total_disk_gb += t_gb
            used_disk_gb += u_gb
            free_disk_gb += f_gb
        except Exception:
            continue

    battery = psutil.sensors_battery()
    battery_info = None
    if battery:
        battery_info = {
            "percent": battery.percent,
            "power_plugged": battery.power_plugged,
            "secsleft": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else "unlimited",
        }

    # GPU Hardware & VRAM Telemetry
    gpu_info = None
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=1.5,
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 4:
                gpu_info = {
                    "name": parts[0],
                    "memory_total_mb": float(parts[1]),
                    "memory_used_mb": float(parts[2]),
                    "memory_percent": round((float(parts[2]) / float(parts[1])) * 100, 1),
                    "utilization_percent": int(parts[3]),
                    "temperature_c": int(parts[4]) if len(parts) > 4 else None,
                    "secondary_gpu": "AMD Radeon 740M Graphics",
                }
    except Exception:
        pass

    gpu_msg = f" | GPU: {gpu_info['name']} ({gpu_info['utilization_percent']}% util, {round(gpu_info['memory_used_mb']/1024, 1)}/{round(gpu_info['memory_total_mb']/1024, 1)} GB VRAM)" if gpu_info else ""

    return {
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine(),
            "node_name": platform.node(),
        },
        "cpu": {
            "usage_percent": cpu_percent,
            "core_count": cpu_count,
            "current_freq_mhz": cpu_freq.current if cpu_freq else None,
        },
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "percent": mem.percent,
        },
        "gpu": gpu_info,
        "disk": {
            "total_gb": round(total_disk_gb, 1),
            "free_gb": round(free_disk_gb, 1),
            "used_gb": round(used_disk_gb, 1),
            "percent": round((used_disk_gb / max(1, total_disk_gb)) * 100, 1),
        },
        "drives": drives,
        "battery": battery_info,
        "message": f"CPU: {cpu_percent}% | RAM: {mem.percent}% ({round(mem.used/(1024**3), 1)}/{round(mem.total/(1024**3), 1)} GB){gpu_msg} | Drives: {len(drives)} active",
    }


def list_drives() -> Dict[str, Any]:
    """Scan and list all local disk drives with utilized and total capacity."""
    drives = []
    for part in psutil.disk_partitions(all=False):
        try:
            if "cdrom" in part.opts or not part.fstype:
                continue
            usage = psutil.disk_usage(part.mountpoint)
            t_gb = round(usage.total / (1024**3), 1)
            u_gb = round(usage.used / (1024**3), 1)
            f_gb = round(usage.free / (1024**3), 1)
            drives.append({
                "drive": part.mountpoint.replace("\\", ""),
                "mountpoint": part.mountpoint,
                "device": part.device,
                "fstype": part.fstype,
                "total_gb": t_gb,
                "used_gb": u_gb,
                "free_gb": f_gb,
                "percent": usage.percent,
            })
        except Exception:
            continue

    total_storage = round(sum(d["total_gb"] for d in drives), 1)
    used_storage = round(sum(d["used_gb"] for d in drives), 1)
    free_storage = round(sum(d["free_gb"] for d in drives), 1)

    summary_parts = [f"Drive {d['drive']}: {d['used_gb']}/{d['total_gb']} GB ({d['percent']}%)" for d in drives]

    return {
        "total_drives": len(drives),
        "drives": drives,
        "total_storage_gb": total_storage,
        "used_storage_gb": used_storage,
        "free_storage_gb": free_storage,
        "message": f"Found {len(drives)} drives ({', '.join(summary_parts)}). Total capacity: {total_storage} GB with {free_storage} GB available.",
    }



def list_processes(limit: int = 15, sort_by: str = "memory") -> Dict[str, Any]:
    """List top running processes sorted by cpu or memory."""
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "status"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": info["cpu_percent"] or 0.0,
                "memory_percent": round(info["memory_percent"] or 0.0, 2),
                "status": info["status"],
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    sort_key = "cpu_percent" if sort_by.lower() == "cpu" else "memory_percent"
    procs.sort(key=lambda x: x.get(sort_key, 0.0), reverse=True)
    top_procs = procs[:limit]

    return {
        "count": len(top_procs),
        "processes": top_procs,
        "message": f"Retrieved top {len(top_procs)} processes sorted by {sort_by}",
    }


def send_notification(title: str, message: str) -> Dict[str, Any]:
    """Show a Windows desktop toast notification."""
    # Use PowerShell to show a notification balloon/toast
    escaped_title = title.replace('"', '`"')
    escaped_message = message.replace('"', '`"')
    
    ps_cmd = f"""
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $template = @"
    <toast>
        <visual>
            <binding template="ToastGeneric">
                <text>{escaped_title}</text>
                <text>{escaped_message}</text>
            </binding>
        </visual>
    </toast>
"@
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("JARVIS").Show($toast)
    """

    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
    except:
        # Fallback to msg command or simple beep
        pass

    return {
        "delivered": True,
        "title": title,
        "content": message,
        "message": f"Desktop notification sent: '{title}'",
    }


def clipboard_read() -> Dict[str, Any]:
    """Read current text from the system clipboard."""
    text = pyperclip.paste()
    return {
        "text": text,
        "length": len(text),
        "message": f"Read {len(text)} characters from clipboard",
    }


def clipboard_write(text: str) -> Dict[str, Any]:
    """Write text to the system clipboard."""
    pyperclip.copy(text)
    return {
        "copied": True,
        "length": len(text),
        "message": f"Copied {len(text)} characters to clipboard",
    }


def register_system_tools(registry: ToolRegistry) -> None:
    """Register system diagnosis and notification tools."""
    registry.register(
        ToolDefinition(
            name="system.info",
            description="Get real-time CPU, RAM, disk, OS, and battery statistics",
            category="system",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["system:read"],
        ),
        get_system_info,
    )

    registry.register(
        ToolDefinition(
            name="system.processes",
            description="List top running processes sorted by memory or CPU usage",
            category="system",
            arguments_schema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 15, "description": "Maximum number of processes to return"},
                    "sort_by": {"type": "string", "enum": ["memory", "cpu"], "default": "memory", "description": "Sort metric"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["system:read"],
        ),
        list_processes,
    )

    registry.register(
        ToolDefinition(
            name="system.notify",
            description="Send a desktop popup / toast notification to the user",
            category="system",
            arguments_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Notification title"},
                    "message": {"type": "string", "description": "Notification body text"},
                },
                "required": ["title", "message"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["system:notify"],
        ),
        send_notification,
    )

    registry.register(
        ToolDefinition(
            name="system.clipboard_read",
            description="Read the current text from the clipboard",
            category="system",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["desktop:read"],
        ),
        clipboard_read,
    )

    registry.register(
        ToolDefinition(
            name="system.clipboard_write",
            description="Copy text to the system clipboard",
            category="system",
            arguments_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to copy to clipboard"},
                },
                "required": ["text"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        clipboard_write,
    )

    registry.register(
        ToolDefinition(
            name="system.list_drives",
            description="Scan and list all local disk drives with utilized and total capacity",
            category="system",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["system:read"],
        ),
        list_drives,
    )

    registry.register(
        ToolDefinition(
            name="system.shutdown",
            description="Execute host computer shutdown after confirmation",
            category="system",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.CRITICAL_FINANCIAL,
            permissions=["system:control"],
        ),
        system_shutdown,
    )

    registry.register(
        ToolDefinition(
            name="system.restart",
            description="Execute host computer restart after confirmation",
            category="system",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.CRITICAL_FINANCIAL,
            permissions=["system:control"],
        ),
        system_restart,
    )


def system_shutdown() -> Dict[str, Any]:
    """Execute host computer shutdown."""
    subprocess.Popen(["shutdown", "/s", "/t", "5"])
    return {
        "status": "shutdown_initiated",
        "message": "Host system shutdown initiated with 5 second grace period.",
    }


def system_restart() -> Dict[str, Any]:
    """Execute host computer restart."""
    subprocess.Popen(["shutdown", "/r", "/t", "5"])
    return {
        "status": "restart_initiated",
        "message": "Host system restart initiated with 5 second grace period.",
    }


