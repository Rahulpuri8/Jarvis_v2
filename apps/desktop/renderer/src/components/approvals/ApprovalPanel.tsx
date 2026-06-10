import type { ActionProposal, CommandProposalPayload, FileWritePayload } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface ApprovalPanelProps {
  pendingActions: ActionProposal[];
  onApprove: (actionId: string) => Promise<void>;
  onReject: (actionId: string) => Promise<void>;
}

export const ApprovalPanel = ({ pendingActions, onApprove, onReject }: ApprovalPanelProps) => (
  <Panel title="Approval Queue" subtitle="Every write and command proposal is reviewed before execution.">
    <div className="h-full overflow-y-auto p-4">
      {pendingActions.length === 0 ? (
        <p className="text-sm text-slate-400">No pending actions yet.</p>
      ) : (
        <div className="space-y-4">
          {pendingActions.map((action) => (
            <article key={action.id} className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{action.description}</h3>
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-300">{action.actionType}</p>
                </div>
                <span className="rounded-full border border-amber-300/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                  {action.riskLevel}
                </span>
              </div>
              {action.actionType === 'COMMAND' ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-300">
                  <p className="mb-2 text-slate-400">Command</p>
                  <pre className="whitespace-pre-wrap">{(action.payload as CommandProposalPayload).command}</pre>
                  <p className="mt-3 mb-2 text-slate-400">Working directory</p>
                  <pre className="whitespace-pre-wrap">{(action.payload as CommandProposalPayload).cwd}</pre>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-300">
                  <p className="mb-2 text-slate-400">File path</p>
                  <pre className="whitespace-pre-wrap">{(action.payload as FileWritePayload).filePath}</pre>
                  <p className="mt-3 mb-2 text-slate-400">Preview</p>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap">{(action.payload as FileWritePayload).afterContent}</pre>
                </div>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => void onApprove(action.id)}
                  className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm text-emerald-200"
                >
                  {action.actionType === 'COMMAND' ? 'Approve and Run' : 'Approve Write'}
                </button>
                <button
                  type="button"
                  onClick={() => void onReject(action.id)}
                  className="rounded-full border border-rose-300/30 px-4 py-2 text-sm text-rose-200"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </Panel>
);
