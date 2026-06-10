import type { TaskRecord } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface TaskBoardPanelProps {
  tasks: TaskRecord[];
}

const teamOrder = ['Product', 'Frontend', 'Backend', 'AI', 'Database', 'QA', 'DevOps', 'Security'] as const;

export const TaskBoardPanel = ({ tasks }: TaskBoardPanelProps) => (
  <Panel title="Task Board" subtitle="Milestones and ownership grouped by team.">
    <div className="h-full overflow-y-auto p-4">
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">Task breakdown appears after the Project Manager Agent runs.</p>
      ) : (
        <div className="space-y-4">
          {teamOrder.map((team) => {
            const teamTasks = tasks.filter((task) => task.team === team);
            if (teamTasks.length === 0) {
              return null;
            }

            return (
              <section key={team} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <h3 className="mb-3 text-sm font-semibold text-cyan-200">{team}</h3>
                <div className="space-y-3">
                  {teamTasks.map((task) => (
                    <article key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-medium text-slate-100">{task.title}</h4>
                        <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{task.description}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{task.status}</span>
                        <span>Deps: {task.dependenciesJson}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  </Panel>
);
