import type { CommandRunRecord } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface ActionLogPanelProps {
  commandRuns: CommandRunRecord[];
  projectFolderPath: string | null;
  onProposeCommand: (command: string) => Promise<void>;
  logs: string[];
}

export const ActionLogPanel = ({ commandRuns, projectFolderPath, onProposeCommand, logs }: ActionLogPanelProps) => (
  <Panel title="Action Log" subtitle="Folder selection, agent execution, file reads, approvals, and command output.">
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <form
        className="border-b border-white/10 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const command = String(formData.get('command') ?? '').trim();
          if (!command) {
            return;
          }

          await onProposeCommand(command);
          event.currentTarget.reset();
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Command Center</p>
            <p className="text-xs text-slate-500">{projectFolderPath ?? 'Select a folder to run project-scoped commands.'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            name="command"
            className="flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            placeholder="npm test"
          />
          <button type="submit" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
            Propose Command
          </button>
        </div>
      </form>
      <div className="grid min-h-0 grid-cols-2 gap-0">
        <div className="overflow-y-auto border-r border-white/10 p-4">
          <h3 className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">Activity</h3>
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400">Activity will stream here as you work.</p>
            ) : (
              logs.map((log) => (
                <div key={log} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          <h3 className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">Command Output</h3>
          <div className="space-y-3">
            {commandRuns.length === 0 ? (
              <p className="text-sm text-slate-400">Approved command history will appear here.</p>
            ) : (
              commandRuns.map((run) => (
                <article key={run.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-cyan-300">{run.command}</span>
                    <span className="text-slate-500">{run.approvalStatus}</span>
                  </div>
                  <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap text-xs text-slate-300">
                    {run.output || 'No output yet.'}
                  </pre>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  </Panel>
);
