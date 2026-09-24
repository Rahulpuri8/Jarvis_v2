import type { ActionProposal, CommandProposalPayload, FileWritePayload } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';
import { DiffViewer } from './DiffViewer';

interface ApprovalPanelProps {
  pendingActions: ActionProposal[];
  onApprove: (actionId: string) => Promise<void>;
  onReject: (actionId: string) => Promise<void>;
}

function analyzeCommandImpact(cmd: string): { risk: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; consequence: string; recommendation: string } {
  const c = cmd.toLowerCase().trim();

  if (c.includes('rm -rf') || c.includes('del /f') || c.includes('rmdir /s') || c.includes('drop table') || c.includes('format ') || c.includes('kill -9')) {
    return {
      risk: 'HIGH',
      title: 'Destructive File or Process Removal',
      consequence: 'Permanently deletes files, tables, or forcefully terminates processes. These cannot be recovered from the recycle bin.',
      recommendation: 'Verify the target folder/process carefully before approving.',
    };
  }

  if (c.startsWith('git reset') || c.includes('--hard') || c.startsWith('git clean')) {
    return {
      risk: 'HIGH',
      title: 'Repository History / Workspace Reset',
      consequence: 'Will discard all uncommitted changes in your repository. Any unsaved edits will be permanently lost.',
      recommendation: 'Ensure you have stashed or committed needed work before proceeding.',
    };
  }

  if (c.includes('install') || c.includes('pip ') || c.includes('npm ') || c.includes('yarn ') || c.includes('pnpm ')) {
    return {
      risk: 'MEDIUM',
      title: 'Dependency Installation / Environment Mutation',
      consequence: 'Modifies your package manifest (node_modules / virtualenv) and makes external network requests to download code.',
      recommendation: 'Check that package names match trusted sources.',
    };
  }

  if (c.startsWith('mkdir') || c.startsWith('touch') || c.startsWith('cp ') || c.startsWith('mv ') || c.startsWith('rename')) {
    return {
      risk: 'MEDIUM',
      title: 'Filesystem Organization Change',
      consequence: 'Creates, moves, or renames directories or files on your disk.',
      recommendation: 'Verify directory paths to avoid cluttering parent folders.',
    };
  }

  return {
    risk: 'LOW',
    title: 'Standard Execution / Read-Only Task',
    consequence: 'Executes within project boundaries and captures standard output and exit codes.',
    recommendation: 'Safe to approve.',
  };
}

function analyzeFileImpact(payload: FileWritePayload): { risk: 'HIGH' | 'MEDIUM' | 'LOW'; consequence: string } {
  const isEnvOrKey = payload.filePath.includes('.env') || payload.filePath.includes('key') || payload.filePath.includes('secret') || payload.filePath.includes('id_rsa');
  if (isEnvOrKey) {
    return {
      risk: 'HIGH',
      consequence: '⚠️ Sensitive file modification: This file may contain credentials, environment variables, or private keys. Review every line in the diff.',
    };
  }

  if (payload.changeType === 'UPDATE') {
    return {
      risk: 'MEDIUM',
      consequence: 'Existing file content will be replaced. Lines added (+) and removed (-) are highlighted in the diff preview below.',
    };
  }

  return {
    risk: 'LOW',
    consequence: `Creates a new file at ${payload.filePath}. Content will be initialized as previewed below.`,
  };
}

export const ApprovalPanel = ({ pendingActions, onApprove, onReject }: ApprovalPanelProps) => (
  <Panel title="Security & Approval Gate" subtitle="PRE-EXECUTION IMPACT ANALYSIS // STRICT USER CONFIRMATION REQUIRED">
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {pendingActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-3xl text-emerald-400 mb-2">🛡</span>
          <p className="font-hud text-xs uppercase tracking-wider text-slate-300">All Operations Secured</p>
          <p className="font-mono-hud text-[11px] text-slate-500 mt-1 max-w-sm">
            No destructive or unauthorized actions pending. J.A.R.V.I.S requires explicit confirmation before any file modification or system execution.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="font-mono-hud text-xs text-amber-200">
              {pendingActions.length} action(s) require your review. J.A.R.V.I.S has paused execution until you approve or reject each item.
            </p>
          </div>

          {pendingActions.map((action) => {
            const isCommand = action.actionType === 'COMMAND';
            const cmdPayload = isCommand ? (action.payload as CommandProposalPayload) : null;
            const filePayload = !isCommand ? (action.payload as FileWritePayload) : null;

            const cmdImpact = cmdPayload ? analyzeCommandImpact(cmdPayload.command) : null;
            const fileImpact = filePayload ? analyzeFileImpact(filePayload) : null;

            const riskBadgeColor =
              (cmdImpact?.risk === 'HIGH' || fileImpact?.risk === 'HIGH' || action.riskLevel === 'HIGH')
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                : 'border-amber-400/40 bg-amber-400/20 text-amber-300';

            return (
              <article
                key={action.id}
                className="rounded-2xl border border-cyan-400/20 bg-slate-950/85 p-5 shadow-[0_0_20px_rgba(0,212,255,0.06)]"
              >
                {/* Header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-hud text-[10px] uppercase tracking-wider text-cyan-400">
                        {isCommand ? '⚡ SYSTEM COMMAND PROPOSAL' : '📝 FILE MODIFICATION PROPOSAL'}
                      </span>
                    </div>
                    <h3 className="mt-1 font-body text-base font-semibold text-white">{action.description}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 font-mono-hud text-[10px] font-bold uppercase tracking-wider ${riskBadgeColor}`}>
                    {cmdImpact?.risk || fileImpact?.risk || action.riskLevel} RISK
                  </span>
                </div>

                {/* Impact & Consequence Analysis Box */}
                <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
                  <p className="font-hud text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <span>🔍</span>
                    <span>System Impact & Consequence Preview</span>
                  </p>
                  <p className="mt-1.5 font-mono-hud text-xs text-slate-200 leading-relaxed">
                    {cmdImpact ? cmdImpact.consequence : fileImpact?.consequence}
                  </p>
                  {cmdImpact?.recommendation && (
                    <p className="mt-1 font-mono-hud text-[11px] text-slate-400 italic">
                      Recommendation: {cmdImpact.recommendation}
                    </p>
                  )}
                </div>

                {/* Detailed Preview */}
                {isCommand && cmdPayload ? (
                  <div className="space-y-3 mb-4">
                    <div className="rounded-xl border border-white/10 bg-black/60 p-3.5">
                      <p className="font-mono-hud text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                        Command To Run:
                      </p>
                      <pre className="font-mono text-xs text-cyan-300 whitespace-pre-wrap selection:bg-cyan-500/30">
                        {cmdPayload.command}
                      </pre>
                    </div>
                    {cmdPayload.cwd && (
                      <div className="flex items-center gap-2 text-[10px] font-mono-hud text-slate-400">
                        <span>Working Directory:</span>
                        <span className="text-slate-300 truncate">{cmdPayload.cwd}</span>
                      </div>
                    )}
                  </div>
                ) : filePayload ? (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-xs font-mono-hud text-slate-300">
                      <span>Target File: <strong className="text-cyan-300">{filePayload.filePath}</strong></span>
                      <span className="text-slate-500 uppercase">{filePayload.changeType}</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/50 p-2 overflow-hidden">
                      <DiffViewer
                        beforeContent={filePayload.beforeContent || ''}
                        afterContent={filePayload.afterContent || ''}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Explicit Dual Decision Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <span className="font-mono-hud text-[10px] text-slate-500">
                    If approved: runs immediately. If rejected: discarded safely.
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void onReject(action.id)}
                      className="rounded-full border border-rose-400/40 bg-rose-400/10 px-5 py-2 font-hud text-xs uppercase tracking-wider text-rose-300 transition hover:bg-rose-400/20 active:scale-95"
                    >
                      ✕ Reject & Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void onApprove(action.id)}
                      className="rounded-full border border-emerald-400/50 bg-emerald-400/20 px-6 py-2 font-hud text-xs uppercase tracking-wider font-semibold text-emerald-200 transition hover:bg-emerald-400/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-95"
                    >
                      ✓ Approve & Execute
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  </Panel>
);
