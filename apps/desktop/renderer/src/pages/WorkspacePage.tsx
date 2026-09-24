import { useState, useEffect } from 'react';
import type {
  ActionProposal,
  CommandRunRecord,
  FileTreeNode,
  MessageRecord,
  ProjectRecord,
  TaskRecord,
  DocumentRecord,
} from '@buildos/shared/types';
import { ApprovalPanel } from '../components/approvals/ApprovalPanel';
import { ChatPanel } from '../components/chat/ChatPanel';
import { DocumentsPanel } from '../components/documents/DocumentsPanel';
import { FileTreePanel } from '../components/file-tree/FileTreePanel';
import { ActionLogPanel } from '../components/logs/ActionLogPanel';
import { TaskBoardPanel } from '../components/tasks/TaskBoardPanel';
import { ArcHudScreen } from '../components/hud/ArcHudScreen';

interface WorkspacePageProps {
  project: ProjectRecord;
  fileTree: FileTreeNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  messages: MessageRecord[];
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  pendingActions: ActionProposal[];
  commandRuns: CommandRunRecord[];
  logs: string[];
  onSelectFolder: () => Promise<void>;
  onOpenFile: (path: string, explicitApproval?: boolean) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onGenerateStarterFiles: () => Promise<void>;
  onApproveAction: (actionId: string) => Promise<void>;
  onRejectAction: (actionId: string) => Promise<void>;
  onProposeCommand: (command: string) => Promise<void>;
  onOpenSettings: () => void;
  onReboot?: () => void;
}

type TabMode = 'arc' | 'assistant' | 'workspace' | 'apps' | 'approvals' | 'telemetry';

export interface DriveInfo {
  drive: string;
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface DesktopAppInfo {
  name: string;
  appId: string;
  category: 'IDE/Code' | 'Browser' | 'Terminal/CLI' | 'Productivity' | 'AI Tool' | 'System Utility' | 'Media/Other';
  compatibility: 'FULL_AUTOMATION' | 'CLI_CONTROL' | 'LAUNCH_AND_FOCUS' | 'UNSUPPORTED';
  capabilityDescription: string;
  isRunning?: boolean;
  status?: 'RUNNING' | 'IDLE';
}

export interface SystemSpecsInfo {
  totalMemGb: number;
  usedMemGb: number;
  freeMemGb: number;
  memoryPercent: number;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePercent?: number;
  gpuName?: string;
  gpuUsagePercent?: number;
  gpuMemTotalGb?: number;
  gpuMemUsedGb?: number;
  gpuMemPercent?: number;
  gpuTempC?: number;
  isThrottlingAdvised: boolean;
  status: string;
  recommendation: string;
  drives?: DriveInfo[];
}

export type SystemSpecs = SystemSpecsInfo;

export const WorkspacePage = ({
  project,
  fileTree,
  selectedFilePath,
  selectedFileContent,
  messages,
  documents,
  tasks,
  pendingActions,
  commandRuns,
  logs,
  onSelectFolder,
  onOpenFile,
  onSendMessage,
  onGenerateStarterFiles,
  onApproveAction,
  onRejectAction,
  onProposeCommand,
  onOpenSettings,
  onReboot,
}: WorkspacePageProps) => {
  const [activeTab, setActiveTab] = useState<TabMode>('arc');
  const [apps, setApps] = useState<DesktopAppInfo[]>([]);
  const [specs, setSpecs] = useState<SystemSpecsInfo | null>(null);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [appSearch, setAppSearch] = useState<string>('');
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSystemData = async () => {
      let loadedApps = false;
      if ((window as any).buildos?.listDesktopApps) {
        try {
          const list = await (window as any).buildos.listDesktopApps();
          if (list && list.length > 0 && isMounted) {
            setApps(list);
            loadedApps = true;
          }
        } catch {
          // fall through
        }
      }

      if (!loadedApps) {
        try {
          const resp = await fetch('http://127.0.0.1:9321/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'desktop.list_apps', arguments: {} }),
          });
          const json = await resp.json();
          if (json?.data?.apps && Array.isArray(json.data.apps) && json.data.apps.length > 0 && isMounted) {
            setApps(json.data.apps);
            loadedApps = true;
          }
        } catch {
          // fall through
        }
      }

      if (!loadedApps && isMounted) {
        setApps(getFallbackApps());
      }

      let specsLoaded = false;
      try {
        const resp = await fetch('http://127.0.0.1:9321/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'system.info', arguments: {} }),
          signal: AbortSignal.timeout(2000),
        });
        const json = await resp.json();
        if (json?.data && isMounted) {
          const d = json.data;
          const memP = Math.round(d.memory?.percent || 0);
          setSpecs({
            totalMemGb: d.memory?.total_gb || 15.2,
            usedMemGb: d.memory?.used_gb || 13.4,
            freeMemGb: d.memory?.available_gb || 1.8,
            memoryPercent: memP,
            cpuModel: d.cpu?.model || 'AMD Ryzen Host (12 Logical Cores)',
            cpuCores: d.cpu?.core_count || 12,
            cpuUsagePercent: Math.round(d.cpu?.usage_percent ?? 20),
            gpuName: d.gpu?.name || 'NVIDIA GeForce RTX 4050 Laptop GPU',
            gpuUsagePercent: d.gpu?.utilization_percent ?? 0,
            gpuMemTotalGb: d.gpu?.memory_total_mb ? Math.round((d.gpu.memory_total_mb / 1024) * 10) / 10 : 6.0,
            gpuMemUsedGb: d.gpu?.memory_used_mb ? Math.round((d.gpu.memory_used_mb / 1024) * 10) / 10 : 0.6,
            gpuMemPercent: d.gpu?.memory_percent ?? 10,
            gpuTempC: d.gpu?.temperature_c ?? 59,
            isThrottlingAdvised: memP >= 85,
            status: memP >= 85 ? 'THROTTLING_ADVISED' : 'OPTIMAL',
            recommendation: memP >= 85 ? 'RAM elevated (above 85%). Model throttling active.' : 'Resources nominal. Fast execution active.',
            drives: d.drives || [],
          });
          specsLoaded = true;
        }
      } catch {}

      if (!specsLoaded && (window as any).buildos?.getSystemSpecs) {
        try {
          const s = await (window as any).buildos.getSystemSpecs();
          if (isMounted) {
            setSpecs(s);
            specsLoaded = true;
          }
        } catch {}
      }

      if (!specsLoaded && isMounted && !specs) {
        setSpecs(getFallbackSpecs());
      }
    };

    loadSystemData();
    // Continuous 4-second live pulse for real hardware stats and drives
    const pulseTimer = setInterval(loadSystemData, 4000);

    return () => {
      isMounted = false;
      clearInterval(pulseTimer);
    };
  }, []);

  const handleLaunchApp = async (app: DesktopAppInfo) => {
    setLaunchMessage(`Engaging ${app.name}...`);
    try {
      if ((window as any).buildos?.openInVSCode && app.category === 'IDE/Code' && project.folderPath) {
        void (window as any).buildos.openInVSCode(project.folderPath);
      } else if (app.name.toLowerCase().includes('terminal') || app.name.toLowerCase().includes('prompt')) {
        if ((window as any).buildos?.openTerminal && project.folderPath) {
          void (window as any).buildos.openTerminal(project.folderPath);
        }
      } else {
        await fetch('http://127.0.0.1:9321/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'desktop.open_app',
            arguments: { app_name: app.name, app_id: app.appId },
          }),
        });
      }
    } catch (e) {
      console.warn('App launch error:', e);
    }
    setTimeout(() => setLaunchMessage(null), 3500);
  };

  const runningAppsCount = apps.filter((a) => a.isRunning).length;

  const filteredApps = apps.filter((app) => {
    const matchesFilter =
      appFilter === 'all'
        ? true
        : appFilter === 'running'
        ? app.isRunning
        : app.category.toLowerCase().includes(appFilter.toLowerCase());
    const matchesSearch =
      app.name.toLowerCase().includes(appSearch.toLowerCase()) ||
      app.capabilityDescription.toLowerCase().includes(appSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div
      className="jarvis-scanlines flex min-h-screen flex-col text-slate-100 overflow-y-auto overflow-x-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.05) 0%, transparent 50%), #020a18',
      }}
    >
      {/* ── HUD Top Header ── */}
      <header className="relative border-b border-cyan-400/15 px-5 py-2.5">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-3.5">
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30"
              style={{
                boxShadow:
                  '0 0 15px rgba(0,212,255,0.2), inset 0 0 10px rgba(0,212,255,0.1)',
              }}
            >
              <span className="font-hud text-[10px] font-bold text-cyan-300">
                J
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-hud text-[11px] font-bold tracking-[0.25em] text-white">
                  J.A.R.V.I.S
                </span>
                <span className="font-mono-hud text-[9px] uppercase tracking-wider text-cyan-400/70">
                  // DESKTOP AGENT
                </span>
                <div className="status-online ml-1" />
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono-hud text-slate-500">
                <span className="text-emerald-400/90 font-medium">● ALL SYSTEMS OPERATIONAL</span>
                <span>•</span>
                <span>MODEL: qwen2.5-coder:7b</span>
                {specs && (
                  <>
                    <span>•</span>
                    <span className={specs.isThrottlingAdvised ? 'text-amber-400 font-semibold' : 'text-cyan-400/70'}>
                      RAM: {specs.memoryPercent}% ({specs.usedMemGb}/{specs.totalMemGb}GB)
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400/90 font-medium">
                      CPU: {specs.cpuUsagePercent ?? 12}%
                    </span>
                    <span>•</span>
                    <span className="text-cyan-300 font-medium">
                      GPU: {specs.gpuName ? specs.gpuName.replace('NVIDIA GeForce ', '').replace(' Laptop GPU', '') : 'RTX 4050'} ({specs.gpuUsagePercent ?? 0}% • {specs.gpuTempC ?? 59}°C)
                    </span>
                    {specs.drives && specs.drives.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-300 font-medium">
                          DRIVES: {specs.drives.map((d) => `${d.drive} ${d.percent}%`).join(' ')}
                        </span>
                      </>
                    )}
                  </>
                )}
                {project.folderPath ? (
                  <>
                    <span>•</span>
                    <span className="text-cyan-400/80 truncate max-w-xs">{project.folderPath}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Center: HUD Navigation Tabs */}
          <div className="flex items-center gap-1 border border-cyan-400/20 bg-cyan-950/20 p-1 rounded-sm">
            <TabButton
              active={activeTab === 'arc'}
              onClick={() => setActiveTab('arc')}
              icon="◈"
              label="ARC HUD"
            />
            <TabButton
              active={activeTab === 'assistant'}
              onClick={() => setActiveTab('assistant')}
              icon="💬"
              label="ASSISTANT"
            />
            <TabButton
              active={activeTab === 'workspace'}
              onClick={() => setActiveTab('workspace')}
              icon="📁"
              label="WORKSPACE"
              badge={fileTree.length > 0 ? `${fileTree.length}` : undefined}
            />
            <TabButton
              active={activeTab === 'apps'}
              onClick={() => setActiveTab('apps')}
              icon="🖥"
              label="PC APPS"
              badge={apps.length > 0 ? `${apps.length}` : undefined}
            />
            <TabButton
              active={activeTab === 'approvals'}
              onClick={() => setActiveTab('approvals')}
              icon="🛡"
              label="APPROVALS"
              badge={pendingActions.length > 0 ? `${pendingActions.length}` : undefined}
              badgeColor="amber"
            />
            <TabButton
              active={activeTab === 'telemetry'}
              onClick={() => setActiveTab('telemetry')}
              icon="📜"
              label="TELEMETRY"
            />
          </div>

          {/* Right: Quick System Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <HudButton onClick={() => void onSelectFolder()} icon="📂" label="Attach Folder" primary />
            {project.folderPath && (
              <HudButton
                onClick={() => (window as any).buildos?.openInVSCode?.(project.folderPath!)}
                icon="⌨"
                label="VS Code"
              />
            )}
            <HudButton onClick={onOpenSettings} icon="⚙" label="Config" />
            {onReboot && <HudButton onClick={onReboot} icon="🔄" label="Diagnostics" />}
          </div>
        </div>
      </header>

      {/* ── Main View Content ── */}
      <main className="flex-1 p-3 min-h-[560px] flex flex-col">
        {/* Tab 0: Iron Man Movie Arc Reactor Voice & Holographic Windows Interface */}
        {activeTab === 'arc' && (
          <ArcHudScreen
            project={project}
            tasks={tasks}
            messages={messages}
            pendingActions={pendingActions}
            commandRuns={commandRuns}
            specs={specs}
            onSendMessage={onSendMessage}
            onApproveAction={onApproveAction}
            onRejectAction={onRejectAction}
            onSwitchTab={(tab) => setActiveTab(tab)}
            onSelectFolder={onSelectFolder}
          />
        )}

        {/* Tab 1: Assistant Console (Main View) */}
        {activeTab === 'assistant' && (
          <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] gap-3 min-h-0">
            {/* Primary Chat Console */}
            <div className="min-h-0 h-full">
              <ChatPanel
                messages={messages}
                onSend={onSendMessage}
                pendingActions={pendingActions}
                onApproveAction={onApproveAction}
                onRejectAction={onRejectAction}
              />
            </div>

            {/* Quick Context & System HUD Drawer */}
            <div className="flex flex-col gap-3 min-h-0 h-full">
              <div className="flex-1 min-h-0">
                <TaskBoardPanel tasks={tasks} />
              </div>
              <div className="h-48 min-h-0">
                <ApprovalPanel
                  pendingActions={pendingActions}
                  onApprove={onApproveAction}
                  onReject={onRejectAction}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Workspace & Files Mode */}
        {activeTab === 'workspace' && (
          <div className="grid flex-1 grid-cols-[260px_minmax(0,1fr)_340px] gap-3 min-h-0">
            <div className="min-h-0 h-full">
              <FileTreePanel
                fileTree={fileTree}
                selectedFilePath={selectedFilePath}
                selectedFileContent={selectedFileContent}
                onOpenFile={onOpenFile}
              />
            </div>
            <div className="min-h-0 h-full">
              <ChatPanel messages={messages} onSend={onSendMessage} />
            </div>
            <div className="flex flex-col gap-3 min-h-0 h-full">
              <div className="flex-1 min-h-0">
                <DocumentsPanel documents={documents} />
              </div>
              <div className="flex-1 min-h-0">
                <TaskBoardPanel tasks={tasks} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: PC Desktop Apps & Compatibility View */}
        {activeTab === 'apps' && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 pb-12">
            {/* Hardware & Memory Guard HUD Banner */}
            {specs && (
              <div className="rounded-xl border border-cyan-400/25 bg-slate-900/80 p-4 shadow-[0_0_20px_rgba(0,212,255,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <h3 className="font-hud text-xs uppercase tracking-wider text-cyan-200">
                        PC Hardware & Memory Guard Telemetry
                      </h3>
                      <p className="font-mono-hud text-[11px] text-slate-400">
                        CPU: {specs.cpuModel} ({specs.cpuCores} Cores)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono-hud text-xs font-semibold text-white">
                        RAM: {specs.usedMemGb} GB / {specs.totalMemGb} GB ({specs.memoryPercent}%)
                      </p>
                      <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all duration-500 ${
                            specs.memoryPercent > 85 ? 'bg-amber-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${specs.memoryPercent}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 font-mono-hud text-[10px] font-semibold uppercase ${
                        specs.isThrottlingAdvised
                          ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
                          : 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {specs.status}
                    </span>
                  </div>
                </div>
                {specs.isThrottlingAdvised && (
                  <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 font-mono-hud text-[11px] text-amber-200">
                    ⚠ {specs.recommendation}
                  </div>
                )}
              </div>
            )}

            {launchMessage && (
              <div className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 p-2.5 font-mono-hud text-xs text-cyan-200 animate-pulse">
                ◈ {launchMessage}
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `All Apps (${apps.length})` },
                  { id: 'running', label: `Running (${runningAppsCount})` },
                  { id: 'ide', label: 'IDE & Code' },
                  { id: 'browser', label: 'Browsers' },
                  { id: 'terminal', label: 'Terminals' },
                  { id: 'ai', label: 'AI Tools' },
                  { id: 'productivity', label: 'Productivity' },
                  { id: 'system', label: 'System' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAppFilter(f.id)}
                    className={`rounded-md px-3 py-1 font-hud text-[10px] uppercase tracking-wider transition cursor-pointer ${
                      appFilter === f.id
                        ? f.id === 'running'
                          ? 'border border-emerald-400/80 bg-emerald-500/25 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'border border-cyan-400/60 bg-cyan-400/20 text-cyan-200 shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                        : 'border border-white/5 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search installed desktop apps..."
                className="w-64 rounded-xl border border-cyan-400/20 bg-slate-950/80 px-3.5 py-1.5 font-mono-hud text-xs text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Desktop Apps Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredApps.map((app) => (
                <div
                  key={app.appId || app.name}
                  className="rounded-xl border border-cyan-400/15 bg-slate-900/70 p-4 transition-all hover:border-cyan-400/40 hover:bg-slate-900/90 hover:shadow-[0_0_15px_rgba(0,212,255,0.08)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {app.category === 'IDE/Code'
                            ? '⌨'
                            : app.category === 'Browser'
                            ? '🌐'
                            : app.category === 'Terminal/CLI'
                            ? '⚡'
                            : app.category === 'AI Tool'
                            ? '🧠'
                            : app.category === 'Productivity'
                            ? '📄'
                            : '⚙'}
                        </span>
                        <div>
                          <h4 className="font-hud text-xs font-bold text-white tracking-wide">{app.name}</h4>
                          <span className="font-mono-hud text-[9px] uppercase tracking-wider text-slate-500">
                            {app.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {/* Live Running/Idle Status Badge */}
                        {launchMessage && launchMessage.includes(app.name) ? (
                          <span className="rounded px-2 py-0.5 font-mono-hud text-[8px] font-bold uppercase tracking-wider border border-amber-400/50 bg-amber-400/20 text-amber-300 animate-pulse">
                            ● ENGAGING
                          </span>
                        ) : app.isRunning ? (
                          <span className="rounded px-2 py-0.5 font-mono-hud text-[8px] font-bold uppercase tracking-wider border border-emerald-400/50 bg-emerald-400/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            ● RUNNING
                          </span>
                        ) : (
                          <span className="rounded px-2 py-0.5 font-mono-hud text-[8px] font-bold uppercase tracking-wider border border-slate-700/40 bg-slate-800/40 text-slate-400">
                            ● IDLE
                          </span>
                        )}

                        <span
                          className={`rounded px-2 py-0.5 font-mono-hud text-[8px] font-bold uppercase tracking-wider ${
                            app.compatibility === 'FULL_AUTOMATION'
                              ? 'border border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                              : app.compatibility === 'CLI_CONTROL'
                              ? 'border border-cyan-400/30 bg-cyan-400/15 text-cyan-300'
                              : 'border border-amber-400/30 bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {app.compatibility.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono-hud text-[11px] text-slate-300 leading-relaxed mb-3">
                      {app.capabilityDescription}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="font-mono-hud text-[9px] text-slate-500 truncate max-w-[180px]">
                      {app.appId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLaunchApp(app)}
                      className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 font-hud text-[9px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-400/20 active:scale-95"
                    >
                      ▶ Engage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Security & Approvals Mode */}
        {activeTab === 'approvals' && (
          <div className="grid flex-1 grid-cols-2 gap-3 min-h-0">
            <div className="min-h-0 h-full">
              <ApprovalPanel
                pendingActions={pendingActions}
                onApprove={onApproveAction}
                onReject={onRejectAction}
              />
            </div>
            <div className="min-h-0 h-full">
              <ActionLogPanel
                commandRuns={commandRuns}
                projectFolderPath={project.folderPath}
                onProposeCommand={onProposeCommand}
                logs={logs}
              />
            </div>
          </div>
        )}

        {/* Tab 5: Telemetry & Logs Mode */}
        {activeTab === 'telemetry' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* Live Hardware & Drive Diagnostics Matrix */}
            {specs && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* CPU Card */}
                <div className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-3.5 shadow-[0_0_15px_rgba(0,212,255,0.06)]">
                  <div className="flex items-center justify-between text-[10px] font-mono-hud text-slate-400 mb-1">
                    <span className="font-hud font-bold text-cyan-300 uppercase">CPU LOAD</span>
                    <span className="text-emerald-400 font-bold">{specs.cpuUsagePercent ?? 12}%</span>
                  </div>
                  <div className="text-xs font-bold text-white font-mono-hud">{specs.cpuModel}</div>
                  <div className="text-[10px] text-slate-500 font-mono-hud">{specs.cpuCores} Logical Cores</div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.max(5, specs.cpuUsagePercent ?? 12)}%` }}
                    />
                  </div>
                </div>

                {/* RAM Card */}
                <div className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-3.5 shadow-[0_0_15px_rgba(0,212,255,0.06)]">
                  <div className="flex items-center justify-between text-[10px] font-mono-hud text-slate-400 mb-1">
                    <span className="font-hud font-bold text-cyan-300 uppercase">RAM MEMORY</span>
                    <span className={specs.isThrottlingAdvised ? 'text-amber-400 font-bold' : 'text-cyan-300 font-bold'}>
                      {specs.memoryPercent}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white font-mono-hud">{specs.usedMemGb} GB / {specs.totalMemGb} GB</div>
                  <div className="text-[10px] text-slate-500 font-mono-hud">{specs.freeMemGb} GB Available</div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
                    <div
                      className={`h-full transition-all duration-300 ${specs.memoryPercent > 85 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ width: `${specs.memoryPercent}%` }}
                    />
                  </div>
                </div>

                {/* GPU Card */}
                <div className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-3.5 shadow-[0_0_15px_rgba(0,212,255,0.06)]">
                  <div className="flex items-center justify-between text-[10px] font-mono-hud text-slate-400 mb-1">
                    <span className="font-hud font-bold text-cyan-300 uppercase">GPU ACCELERATOR</span>
                    <span className="text-emerald-400 font-bold">{specs.gpuTempC ?? 61}°C</span>
                  </div>
                  <div className="text-xs font-bold text-white font-mono-hud truncate">
                    {specs.gpuName ? specs.gpuName.replace('NVIDIA GeForce ', '') : 'RTX 4050 Laptop GPU'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-hud">
                    Load: {specs.gpuUsagePercent ?? 0}% • VRAM: {specs.gpuMemUsedGb ?? 0.6}/{specs.gpuMemTotalGb ?? 6.0} GB
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all duration-300"
                      style={{ width: `${Math.max(5, specs.gpuUsagePercent ?? 5)}%` }}
                    />
                  </div>
                </div>

                {/* Storage Drives Card */}
                <div className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-3.5 shadow-[0_0_15px_rgba(0,212,255,0.06)]">
                  <div className="flex items-center justify-between text-[10px] font-mono-hud text-slate-400 mb-1">
                    <span className="font-hud font-bold text-cyan-300 uppercase">LOCAL STORAGE DRIVES</span>
                    <span className="text-cyan-300 font-bold">
                      {specs.drives ? `${specs.drives.length} DRIVES` : '2 DRIVES'}
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-1.5">
                    {specs.drives && specs.drives.length > 0 ? (
                      specs.drives.map((d) => (
                        <div key={d.drive}>
                          <div className="flex justify-between text-[9px] font-mono-hud text-slate-300">
                            <span className="font-bold text-cyan-200">Drive {d.drive}</span>
                            <span>{d.used_gb}/{d.total_gb} GB ({d.percent}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full ${d.percent > 85 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                              style={{ width: `${d.percent}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] font-mono-hud text-slate-400">
                        Drive C: 356.2/438.3 GB • Drive D: 393.5/491.5 GB
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-[350px]">
              <ActionLogPanel
                commandRuns={commandRuns}
                projectFolderPath={project.folderPath}
                onProposeCommand={onProposeCommand}
                logs={logs}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom HUD Footer ── */}
      <footer className="flex items-center justify-between border-t border-cyan-400/10 px-5 py-1.5 text-[9px] font-mono-hud text-slate-500">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400/80">SYS: OPERATIONAL</span>
          <span>•</span>
          <span>SEC: APPROVAL-GATED</span>
          <span>•</span>
          <span>
            AGENTS: {messages.length > 0 ? 'ACTIVE' : 'STANDBY'}
          </span>
          <span>•</span>
          <span>SESSION: {project.name}</span>
        </div>
        <span className="text-cyan-400/50 hud-text-flicker">
          J.A.R.V.I.S — Just A Rather Very Intelligent System
        </span>
      </footer>
    </div>
  );
};

function getFallbackSpecs(): SystemSpecsInfo {
  return {
    totalMemGb: 15.2,
    usedMemGb: 13.3,
    freeMemGb: 1.9,
    memoryPercent: 87,
    cpuModel: 'AMD Ryzen Host (12 Logical Cores)',
    cpuCores: 12,
    cpuUsagePercent: 20,
    gpuName: 'NVIDIA GeForce RTX 4050 Laptop GPU',
    gpuUsagePercent: 12,
    gpuMemTotalGb: 6.0,
    gpuMemUsedGb: 0.6,
    gpuMemPercent: 10,
    gpuTempC: 59,
    isThrottlingAdvised: true,
    status: 'WARNING_HIGH_MEMORY',
    recommendation: 'Resources monitored. Dynamic power scaling active.',
    drives: [
      { drive: 'C:', mountpoint: 'C:\\', device: 'C:\\', fstype: 'NTFS', total_gb: 438.3, used_gb: 356.2, free_gb: 82.1, percent: 81.3 },
      { drive: 'D:', mountpoint: 'D:\\', device: 'D:\\', fstype: 'NTFS', total_gb: 491.5, used_gb: 393.5, free_gb: 98.0, percent: 80.1 },
    ],
  };
}

function getFallbackApps(): DesktopAppInfo[] {
  return [
    {
      name: 'Visual Studio Code',
      appId: 'Microsoft.VisualStudioCode',
      category: 'IDE/Code',
      compatibility: 'FULL_AUTOMATION',
      capabilityDescription: 'Direct workspace opening, file editing, integrated terminal execution, git commits.',
    },
    {
      name: 'Google Chrome',
      appId: 'Chrome',
      category: 'Browser',
      compatibility: 'FULL_AUTOMATION',
      capabilityDescription: 'Web browsing, URL content extraction, web scraping, and browser subagent testing.',
    },
    {
      name: 'Android Studio',
      appId: 'AndroidStudio',
      category: 'IDE/Code',
      compatibility: 'FULL_AUTOMATION',
      capabilityDescription: 'Build APKs, launch Android emulators, run Gradle commands, inspect device UI.',
    },
    {
      name: 'Command Prompt / PowerShell',
      appId: 'cmd.exe / powershell.exe',
      category: 'Terminal/CLI',
      compatibility: 'FULL_AUTOMATION',
      capabilityDescription: 'Execute shell commands, run test suites, install packages with security approval.',
    },
    {
      name: 'ChatGPT / Claude Desktop',
      appId: 'OpenAI.Codex / Claude',
      category: 'AI Tool',
      compatibility: 'CLI_CONTROL',
      capabilityDescription: 'AI model handoff, prompt syncing, collaborative task review.',
    },
    {
      name: 'Microsoft Word / Excel / Access',
      appId: 'Microsoft.Office',
      category: 'Productivity',
      compatibility: 'LAUNCH_AND_FOCUS',
      capabilityDescription: 'Generate markdown/csv reports, view spreadsheets, export tabular data.',
    },
    {
      name: 'Adobe Acrobat Reader',
      appId: 'Adobe.Reader',
      category: 'Productivity',
      compatibility: 'LAUNCH_AND_FOCUS',
      capabilityDescription: 'View generated PDF design documents, architectural diagrams, and documentation.',
    },
    {
      name: 'Task Manager / System Settings',
      appId: 'taskmgr.exe',
      category: 'System Utility',
      compatibility: 'CLI_CONTROL',
      capabilityDescription: 'Inspect running system processes, monitor RAM/CPU load, adjust execution limits.',
    },
  ];
}

/* ── Tab Switcher Button ── */
const TabButton = ({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string;
  badgeColor?: 'cyan' | 'amber';
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1 font-hud text-[9px] uppercase tracking-[0.2em] transition rounded-sm ${
      active
        ? 'border border-cyan-400/60 bg-cyan-400/20 text-cyan-200 shadow-[0_0_10px_rgba(0,212,255,0.2)]'
        : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/5'
    }`}
  >
    <span className="text-xs">{icon}</span>
    <span>{label}</span>
    {badge && (
      <span
        className={`ml-0.5 rounded px-1 py-0.2 text-[8px] font-mono-hud font-bold ${
          badgeColor === 'amber'
            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
            : 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40'
        }`}
      >
        {badge}
      </span>
    )}
  </button>
);

/* ── HUD Button component ── */
const HudButton = ({
  onClick,
  icon,
  label,
  primary,
  accent,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  primary?: boolean;
  accent?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 font-hud text-[9px] uppercase tracking-[0.2em] transition ${
      primary
        ? 'border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/15 hover:shadow-[0_0_12px_rgba(0,212,255,0.1)]'
        : accent
        ? 'border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 hover:shadow-[0_0_12px_rgba(245,166,35,0.1)]'
        : 'border border-white/8 text-slate-400 hover:border-cyan-400/20 hover:text-cyan-300'
    }`}
  >
    <span className="text-xs">{icon}</span>
    {label}
  </button>
);
