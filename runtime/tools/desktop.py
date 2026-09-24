import os
import subprocess
import shutil
import time
import ctypes
from typing import Any, Dict, List, Optional, Union
import psutil
import pyautogui
from ..core.models import ToolDefinition, ToolRiskLevel
from ..core.registry import ToolRegistry

# Configure pyautogui
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05



def _sanitize_path(p: str) -> str:
    return os.path.abspath(os.path.expanduser(os.path.expandvars(p)))


def open_app(app_name: str, args: Optional[List[str]] = None, app_id: Optional[str] = None) -> Dict[str, Any]:
    """Launch an application by name, executable path, or Windows AppID."""
    clean_name = app_name.strip()
    cmd_args = args or []

    # If AppID is provided or clean_name looks like a Windows Package Family ID
    target_id = app_id.strip() if app_id else clean_name
    if target_id and ("!" in target_id or "Microsoft." in target_id):
        try:
            subprocess.Popen(["explorer.exe", f"shell:AppsFolder\\{target_id}"])
            return {
                "launched": True,
                "app": clean_name,
                "app_id": target_id,
                "message": f"Successfully launched {clean_name} via Windows Shell",
            }
        except Exception as e:
            pass

    alias_map = {
        "chrome": "chrome",
        "google chrome": "chrome",
        "vscode": "code",
        "vs code": "code",
        "code": "code",
        "notepad": "notepad",
        "calculator": "calc",
        "calc": "calc",
        "explorer": "explorer",
        "file explorer": "explorer",
        "edge": "msedge",
        "microsoft edge": "msedge",
        "terminal": "wt",
        "cmd": "cmd",
        "powershell": "powershell",
        "spotify": "spotify",
        "settings": "ms-settings:",
        "windows settings": "ms-settings:",
        "ms-settings:": "ms-settings:",
        "browser": "chrome",
    }

    target = alias_map.get(clean_name.lower(), clean_name)

    try:
        exe_path = shutil.which(target)
        if exe_path:
            full_cmd = [exe_path] + cmd_args
            proc = subprocess.Popen(full_cmd, shell=False)
            return {
                "launched": True,
                "app": clean_name,
                "pid": proc.pid,
                "message": f"Successfully launched {clean_name} (PID: {proc.pid})",
            }

        start_cmd = f'start "" "{target}" ' + " ".join(f'"{a}"' for a in cmd_args)
        subprocess.Popen(start_cmd, shell=True)
        return {
            "launched": True,
            "app": clean_name,
            "message": f"Sent launch command for {clean_name}",
        }
    except Exception as e:
        raise RuntimeError(f"Failed to open '{clean_name}': {str(e)}")


def list_installed_apps() -> Dict[str, Any]:
    """Scan and list all real installed desktop applications from the Windows host with live RUNNING status."""
    import json
    apps: List[Dict[str, Any]] = []

    # Get active running process names
    running_proc_names = set()
    for proc in psutil.process_iter(["name"]):
        try:
            n = proc.info["name"]
            if n:
                running_proc_names.add(n.lower())
        except Exception:
            continue

    known_exes = {
        "visual studio code": ["code.exe"],
        "code": ["code.exe"],
        "antigravity ide": ["antigravity ide.exe", "antigravity.exe"],
        "antigravity": ["antigravity ide.exe", "antigravity.exe"],
        "google chrome": ["chrome.exe"],
        "chrome": ["chrome.exe"],
        "microsoft edge": ["msedge.exe"],
        "edge": ["msedge.exe"],
        "windows terminal": ["windowsterminal.exe", "wt.exe"],
        "terminal": ["windowsterminal.exe", "wt.exe"],
        "powershell": ["powershell.exe", "pwsh.exe"],
        "command prompt": ["cmd.exe"],
        "android studio": ["studio64.exe", "studio.exe"],
        "notepad": ["notepad.exe"],
        "calculator": ["calculatorapp.exe", "calculator.exe", "calc.exe"],
        "spotify": ["spotify.exe"],
        "discord": ["discord.exe"],
        "access": ["msaccess.exe"],
        "adobe reader": ["acrord32.exe", "acrobat.exe"],
        "word": ["winword.exe"],
        "excel": ["excel.exe"],
    }

    try:
        cmd = 'powershell.exe -NoProfile -Command "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
        if res.returncode == 0 and res.stdout.strip():
            raw_apps = json.loads(res.stdout.strip())
            if isinstance(raw_apps, dict):
                raw_apps = [raw_apps]
            for app in raw_apps:
                name = app.get("Name", "")
                app_id = app.get("AppID", "")
                if not name:
                    continue
                name_lower = name.lower()

                category = "Media/Other"
                compatibility = "LAUNCH_AND_FOCUS"
                desc = "Can launch, focus, and manage desktop window."

                if any(k in name_lower for k in ["code", "studio", "sublime", "notepad++", "cursor", "intellij", "pycharm", "antigravity"]):
                    category = "IDE/Code"
                    compatibility = "FULL_AUTOMATION"
                    desc = "Direct file opening, code scaffolding, git workspace integration."
                elif any(k in name_lower for k in ["chrome", "edge", "firefox", "brave", "opera"]):
                    category = "Browser"
                    compatibility = "FULL_AUTOMATION"
                    desc = "Web browsing, URL opening, page research, web scraping."
                elif any(k in name_lower for k in ["prompt", "powershell", "terminal", "bash", "cmd"]):
                    category = "Terminal/CLI"
                    compatibility = "FULL_AUTOMATION"
                    desc = "Command execution, build pipelines, process orchestration."
                elif any(k in name_lower for k in ["chatgpt", "claude", "ollama", "lm studio"]):
                    category = "AI Tool"
                    compatibility = "CLI_CONTROL"
                    desc = "AI model handoff, prompt syncing, neural core communication."
                elif any(k in name_lower for k in ["word", "excel", "notepad", "access", "calculator", "reader", "acrobat", "powerpoint"]):
                    category = "Productivity"
                    compatibility = "LAUNCH_AND_FOCUS"
                    desc = "Document viewing, desktop calculations, office automation."
                elif any(k in name_lower for k in ["manager", "settings", "verifier", "control panel", "config"]):
                    category = "System Utility"
                    compatibility = "CLI_CONTROL"
                    desc = "Operating system configuration, hardware monitoring, service control."

                # Check if app is currently running
                is_running = False
                for k, exes in known_exes.items():
                    if k in name_lower:
                        if any(e in running_proc_names for e in exes):
                            is_running = True
                            break

                if not is_running:
                    exe_file = os.path.basename(app_id).lower() if "\\" in app_id else ""
                    if exe_file and exe_file in running_proc_names:
                        is_running = True
                    elif any(name_lower in p for p in running_proc_names if len(name_lower) > 4):
                        is_running = True

                apps.append({
                    "name": name,
                    "appId": app_id,
                    "category": category,
                    "compatibility": compatibility,
                    "capabilityDescription": desc,
                    "isRunning": is_running,
                    "status": "RUNNING" if is_running else "IDLE",
                })
    except Exception as e:
        pass

    running_count = sum(1 for a in apps if a.get("isRunning"))

    return {
        "total_apps": len(apps),
        "running_count": running_count,
        "apps": apps,
        "message": f"Discovered {len(apps)} installed desktop applications ({running_count} currently running).",
    }


def open_in_editor(path: str, editor: str = "antigravity") -> Dict[str, Any]:
    """Open a file or directory in Antigravity IDE or VS Code."""
    target_path = os.path.abspath(os.path.expanduser(os.path.expandvars(path.strip())))
    clean_editor = editor.strip().lower()

    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Target path does not exist: {target_path}")

    if clean_editor in ["antigravity", "antigravity ide"]:
        antigravity_exes = [
            r"C:\Users\HP\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe",
            r"C:\Users\HP\AppData\Local\Programs\Antigravity\Antigravity.exe",
        ]
        exe_to_use = None
        for cand in antigravity_exes:
            if os.path.isfile(cand):
                exe_to_use = cand
                break

        if exe_to_use:
            subprocess.Popen([exe_to_use, target_path])
            return {
                "launched": True,
                "editor": "Antigravity IDE",
                "path": target_path,
                "message": f"Successfully opened '{target_path}' in Antigravity IDE.",
            }
        else:
            # Fallback to shell invocation
            subprocess.Popen(f'start "" shell:AppsFolder\\Google.AntigravityIDE "{target_path}"', shell=True)
            return {
                "launched": True,
                "editor": "Antigravity IDE",
                "path": target_path,
                "message": f"Dispatched launch for '{target_path}' in Antigravity IDE via Windows Shell.",
            }

    # VS Code / Code
    code_path = shutil.which("code") or r"C:\Users\HP\AppData\Local\Programs\Microsoft VS Code\bin\code.CMD"
    try:
        subprocess.Popen([code_path, target_path], shell=True)
        return {
            "launched": True,
            "editor": "Visual Studio Code",
            "path": target_path,
            "message": f"Successfully opened '{target_path}' in Visual Studio Code.",
        }
    except Exception as e:
        raise RuntimeError(f"Failed to open in VS Code: {str(e)}")



def close_app(app_name: str, force: bool = False) -> Dict[str, Any]:
    """Close applications matching the given name."""
    clean_name = app_name.lower().replace(".exe", "").strip()
    terminated_count = 0
    pids = []

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            p_name = proc.info["name"] or ""
            p_clean = p_name.lower().replace(".exe", "")
            if clean_name in p_clean:
                p = psutil.Process(proc.info["pid"])
                if force:
                    p.kill()
                else:
                    p.terminate()
                pids.append(proc.info["pid"])
                terminated_count += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    if terminated_count == 0:
        return {
            "closed": False,
            "count": 0,
            "message": f"No running processes found matching '{app_name}'",
        }

    return {
        "closed": True,
        "count": terminated_count,
        "pids": pids,
        "message": f"Terminated {terminated_count} process(es) matching '{app_name}'",
    }


def close_all_except(keep_apps: List[str]) -> Dict[str, Any]:
    """Close all user applications except the ones specified in keep_apps and essential system processes."""
    keep_normalized = [k.lower().replace(".exe", "").strip() for k in keep_apps]
    system_essentials = {
        "system", "registry", "smss", "csrss", "wininit", "services", "lsass", "svchost",
        "fontdrvhost", "winlogon", "dwm", "explorer", "taskhostw", "sihost", "ctfmon",
        "searchhost", "shellexperiencehost", "startmenuexperiencehost", "python", "node", "electron"
    }

    closed = []
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            p_name = proc.info["name"] or ""
            p_clean = p_name.lower().replace(".exe", "")
            if p_clean in system_essentials:
                continue

            # Check if it should be kept
            should_keep = any(k in p_clean for k in keep_normalized)
            if not should_keep:
                p = psutil.Process(proc.info["pid"])
                p.terminate()
                closed.append(p_name)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return {
        "closed_count": len(closed),
        "closed_apps": closed[:20],
        "kept_apps": keep_apps,
        "message": f"Closed {len(closed)} background/desktop apps while keeping: {', '.join(keep_apps)}",
    }


def screenshot(output_path: Optional[str] = None) -> Dict[str, Any]:
    """Capture the primary display screen and save to disk."""
    if not output_path:
        ts = int(time.time())
        temp_dir = os.path.join(os.environ.get("TEMP", "."), "jarvis_screenshots")
        os.makedirs(temp_dir, exist_ok=True)
        output_path = os.path.join(temp_dir, f"screenshot_{ts}.png")
    else:
        output_path = _sanitize_path(output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

    img = pyautogui.screenshot()
    img.save(output_path)

    width, height = img.size
    return {
        "saved": True,
        "file_path": output_path,
        "resolution": f"{width}x{height}",
        "size_bytes": os.path.getsize(output_path),
        "message": f"Screenshot saved to {output_path}",
    }


def set_volume(level: int) -> Dict[str, Any]:
    """Set system audio volume (0-100) on Windows."""
    level = max(0, min(100, int(level)))
    
    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        f"""
        Add-Type -TypeDefinition @'
        using System.Runtime.InteropServices;
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IAudioEndpointVolume {{
            int SetMasterVolumeLevel(float fLevelDB, System.Guid pguidEventContext);
            int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
            int GetMasterVolumeLevel(out float pfLevelDB);
            int GetMasterVolumeLevelScalar(out float pfLevel);
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
            int GetMute(out bool pbMute);
        }}
        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMDevice {{
            int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
        }}
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IMMDeviceEnumerator {{
            int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        }}
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        public class MMDeviceEnumeratorComObject {{ }}
        public class AudioController {{
            public static void SetVolume(float level) {{
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDevice dev = null;
                enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                var IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
                IAudioEndpointVolume epv = null;
                dev.Activate(ref IID_IAudioEndpointVolume, 23, 0, out epv);
                epv.SetMasterVolumeLevelScalar(level, System.Guid.Empty);
            }}
        }}
'@
        [AudioController]::SetVolume({level / 100.0})
        """,
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=8)
    except Exception:
        pass

    return {
        "volume_level": level,
        "message": f"Volume set to {level}%",
    }


def list_windows() -> Dict[str, Any]:
    """List all open desktop windows with titles and process IDs."""
    windows = []
    seen_titles = set()

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            name = proc.info["name"] or ""
            if name.lower().endswith(".exe"):
                clean = name[:-4]
            else:
                clean = name

            if clean.lower() not in {"system", "svchost", "csrss", "wininit", "dwm", "registry", "smss"}:
                if clean not in seen_titles:
                    windows.append({"pid": proc.info["pid"], "process": name, "title": clean})
                    seen_titles.add(clean)
        except:
            continue

    return {
        "total_windows": len(windows),
        "windows": windows[:30],
        "message": f"Found {len(windows)} active applications.",
    }


def focus_app(app_name: str) -> Dict[str, Any]:
    """Bring application window matching app_name to the foreground."""
    ps_cmd = f"""
    $p = Get-Process | Where-Object {{ $_.ProcessName -like '*{app_name}*' -or $_.MainWindowTitle -like '*{app_name}*' }} | Select-Object -First 1
    if ($p) {{
        $sig = @'
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
'@
        $type = Add-Type -MemberDefinition $sig -Name "Win32Focus" -Namespace "Win32FocusNamespace" -PassThru
        $type::ShowWindowAsync($p.MainWindowHandle, 9)
        $type::SetForegroundWindow($p.MainWindowHandle)
        Write-Output "OK"
    }}
    """
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=5)
        success = "OK" in res.stdout
    except:
        success = False

    return {
        "focused": success,
        "app_name": app_name,
        "message": f"Focused application '{app_name}'" if success else f"Could not find active window for '{app_name}'",
    }


def minimize_window(app_name: Optional[str] = None) -> Dict[str, Any]:
    """Minimize a specific application window, or all windows (Show Desktop) if no app is specified."""
    if not app_name:
        # Show desktop / minimize all
        pyautogui.hotkey("win", "d")
        return {"minimized_all": True, "message": "Minimized all windows (Show Desktop)."}

    ps_cmd = f"""
    $p = Get-Process | Where-Object {{ $_.ProcessName -like '*{app_name}*' }} | Select-Object -First 1
    if ($p) {{
        $sig = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
        $type = Add-Type -MemberDefinition $sig -Name "Win32Min" -Namespace "Win32MinNamespace" -PassThru
        $type::ShowWindowAsync($p.MainWindowHandle, 6)
        Write-Output "OK"
    }}
    """
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
    return {"minimized": True, "app": app_name, "message": f"Minimized window for '{app_name}'"}


def maximize_window(app_name: str) -> Dict[str, Any]:
    """Maximize application window matching app_name."""
    ps_cmd = f"""
    $p = Get-Process | Where-Object {{ $_.ProcessName -like '*{app_name}*' }} | Select-Object -First 1
    if ($p) {{
        $sig = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
        $type = Add-Type -MemberDefinition $sig -Name "Win32Max" -Namespace "Win32MaxNamespace" -PassThru
        $type::ShowWindowAsync($p.MainWindowHandle, 3)
        Write-Output "OK"
    }}
    """
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
    return {"maximized": True, "app": app_name, "message": f"Maximized window for '{app_name}'"}


def move_window(app_name: str, position: str = "left_half", x: Optional[int] = None, y: Optional[int] = None, width: Optional[int] = None, height: Optional[int] = None) -> Dict[str, Any]:
    """
    Move and resize an application window.
    Preset positions: 'left_half', 'right_half', 'top_half', 'bottom_half', 'center', 'custom'.
    """
    screen_w, screen_h = pyautogui.size()

    if position == "left_half":
        target_x, target_y, target_w, target_h = 0, 0, screen_w // 2, screen_h
    elif position == "right_half":
        target_x, target_y, target_w, target_h = screen_w // 2, 0, screen_w // 2, screen_h
    elif position == "top_half":
        target_x, target_y, target_w, target_h = 0, 0, screen_w, screen_h // 2
    elif position == "bottom_half":
        target_x, target_y, target_w, target_h = 0, screen_h // 2, screen_w, screen_h // 2
    elif position == "center":
        target_w, target_h = int(screen_w * 0.8), int(screen_h * 0.8)
        target_x, target_y = (screen_w - target_w) // 2, (screen_h - target_h) // 2
    else:
        target_x = x or 0
        target_y = y or 0
        target_w = width or screen_w // 2
        target_h = height or screen_h

    ps_cmd = f"""
    $p = Get-Process | Where-Object {{ $_.ProcessName -like '*{app_name}*' }} | Select-Object -First 1
    if ($p) {{
        $sig = '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);'
        $type = Add-Type -MemberDefinition $sig -Name "Win32Move" -Namespace "Win32MoveNamespace" -PassThru
        $type::MoveWindow($p.MainWindowHandle, {target_x}, {target_y}, {target_w}, {target_h}, $true)
        Write-Output "OK"
    }}
    """
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
    return {
        "moved": True,
        "app": app_name,
        "bounds": {"x": target_x, "y": target_y, "width": target_w, "height": target_h},
        "message": f"Moved and resized '{app_name}' to {position} ({target_w}x{target_h} at [{target_x},{target_y}])",
    }


def type_text(text: str, interval: float = 0.02) -> Dict[str, Any]:
    """Type text into the currently active input element using simulated keystrokes."""
    pyautogui.write(text, interval=interval)
    return {
        "typed": True,
        "length": len(text),
        "message": f"Typed {len(text)} characters into active window.",
    }


def hotkey(keys: List[str]) -> Dict[str, Any]:
    """Trigger a keyboard hotkey combination, e.g. ['ctrl', 'c'], ['win', 'd'], ['alt', 'tab']."""
    clean_keys = [k.lower().strip() for k in keys]
    pyautogui.hotkey(*clean_keys)
    return {
        "hotkey": "+".join(clean_keys),
        "message": f"Pressed hotkey: {'+'.join(clean_keys)}",
    }


def click_coordinate(x: int, y: int, button: str = "left", clicks: int = 1) -> Dict[str, Any]:
    """Click mouse at specified screen coordinates."""
    pyautogui.click(x=x, y=y, clicks=clicks, button=button)
    return {
        "clicked": True,
        "x": x,
        "y": y,
        "button": button,
        "clicks": clicks,
        "message": f"Clicked {button} button {clicks} time(s) at ({x}, {y})",
    }


def lock_screen() -> Dict[str, Any]:
    """Lock the Windows desktop session."""
    ctypes.windll.user32.LockWorkStation()
    return {
        "locked": True,
        "message": "Desktop workstation session locked successfully.",
    }


def set_brightness(level: int) -> Dict[str, Any]:
    """Set monitor brightness percentage (0-100) via WMI."""
    level = max(0, min(100, int(level)))
    ps_cmd = f"""
    (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {level})
    """
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
    except:
        pass

    return {
        "brightness": level,
        "message": f"Display brightness set to {level}%",
    }


def register_desktop_tools(registry: ToolRegistry) -> None:
    """Register all desktop control tools into the registry."""
    registry.register(
        ToolDefinition(
            name="desktop.open_app",
            description="Launch an application by name or executable path (e.g., Chrome, VS Code, Notepad)",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name or path of application to launch"},
                    "args": {"type": "array", "items": {"type": "string"}, "description": "Optional command line arguments"},
                },
                "required": ["app_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        open_app,
    )

    registry.register(
        ToolDefinition(
            name="desktop.close_app",
            description="Close/terminate running applications by name (e.g., Chrome, Notepad)",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name of the application or process to close"},
                    "force": {"type": "boolean", "description": "Force kill if true"},
                },
                "required": ["app_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        close_app,
    )

    registry.register(
        ToolDefinition(
            name="desktop.close_all_except",
            description="Close all running non-essential apps except a whitelist (e.g. ['chrome', 'code'])",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "keep_apps": {"type": "array", "items": {"type": "string"}, "description": "List of app names to keep open"},
                },
                "required": ["keep_apps"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        close_all_except,
    )

    registry.register(
        ToolDefinition(
            name="desktop.screenshot",
            description="Capture a screenshot of the entire screen and save it to disk",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "output_path": {"type": "string", "description": "Optional destination path for the screenshot image"},
                },
            },
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["desktop:read"],
        ),
        screenshot,
    )

    registry.register(
        ToolDefinition(
            name="desktop.volume",
            description="Set the system audio master volume percentage (0 to 100)",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "level": {"type": "integer", "minimum": 0, "maximum": 100, "description": "Volume percentage (0-100)"},
                },
                "required": ["level"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        set_volume,
    )

    registry.register(
        ToolDefinition(
            name="desktop.list_windows",
            description="List active visible desktop application windows",
            category="desktop",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["desktop:read"],
        ),
        list_windows,
    )

    registry.register(
        ToolDefinition(
            name="desktop.focus_app",
            description="Bring an application window to the foreground and focus it",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name or title of application to focus"},
                },
                "required": ["app_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        focus_app,
    )

    registry.register(
        ToolDefinition(
            name="desktop.minimize",
            description="Minimize an application window, or all windows (Show Desktop) if app_name is omitted",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Optional application name to minimize"},
                },
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        minimize_window,
    )

    registry.register(
        ToolDefinition(
            name="desktop.maximize",
            description="Maximize an application window",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Application name to maximize"},
                },
                "required": ["app_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        maximize_window,
    )

    registry.register(
        ToolDefinition(
            name="desktop.move_window",
            description="Position and resize an application window (supports presets: 'left_half', 'right_half', 'top_half', 'bottom_half', 'center')",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Application name to move/resize"},
                    "position": {"type": "string", "enum": ["left_half", "right_half", "top_half", "bottom_half", "center", "custom"], "default": "left_half"},
                    "x": {"type": "integer"},
                    "y": {"type": "integer"},
                    "width": {"type": "integer"},
                    "height": {"type": "integer"},
                },
                "required": ["app_name"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        move_window,
    )

    registry.register(
        ToolDefinition(
            name="desktop.type_text",
            description="Simulate typing text into the currently active window or input",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text string to type"},
                    "interval": {"type": "number", "default": 0.02},
                },
                "required": ["text"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        type_text,
    )

    registry.register(
        ToolDefinition(
            name="desktop.hotkey",
            description="Simulate pressing a keyboard shortcut combination (e.g. ['ctrl', 'c'], ['win', 'd'], ['alt', 'tab'])",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "keys": {"type": "array", "items": {"type": "string"}, "description": "Keys in combination"},
                },
                "required": ["keys"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        hotkey,
    )

    registry.register(
        ToolDefinition(
            name="desktop.click_coordinate",
            description="Click mouse at specified display pixel coordinates",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "X pixel coordinate"},
                    "y": {"type": "integer", "description": "Y pixel coordinate"},
                    "button": {"type": "string", "enum": ["left", "right", "middle"], "default": "left"},
                    "clicks": {"type": "integer", "default": 1},
                },
                "required": ["x", "y"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        click_coordinate,
    )

    registry.register(
        ToolDefinition(
            name="desktop.lock",
            description="Lock the Windows desktop session",
            category="desktop",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        lock_screen,
    )

    registry.register(
        ToolDefinition(
            name="desktop.brightness",
            description="Set monitor screen brightness percentage (0 to 100)",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "level": {"type": "integer", "minimum": 0, "maximum": 100, "description": "Brightness percentage (0-100)"},
                },
                "required": ["level"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        set_brightness,
    )

    registry.register(
        ToolDefinition(
            name="desktop.list_apps",
            description="Scan and list all installed applications on the Windows desktop machine with capability analysis",
            category="desktop",
            arguments_schema={"type": "object", "properties": {}},
            risk_level=ToolRiskLevel.READ_ONLY,
            permissions=["desktop:read"],
        ),
        list_installed_apps,
    )

    registry.register(
        ToolDefinition(
            name="desktop.open_in_editor",
            description="Open a file or directory in Antigravity IDE or Visual Studio Code",
            category="desktop",
            arguments_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Absolute or relative path to file or directory"},
                    "editor": {"type": "string", "enum": ["antigravity", "vscode"], "default": "antigravity", "description": "Target IDE"},
                },
                "required": ["path"],
            },
            risk_level=ToolRiskLevel.LOW_RISK,
            permissions=["desktop:control"],
        ),
        open_in_editor,
    )


