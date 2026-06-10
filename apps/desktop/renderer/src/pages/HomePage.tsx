import { useState } from 'react';
import type { ProjectRecord } from '@buildos/shared/types';

interface HomePageProps {
  projects: ProjectRecord[];
  error?: string | null;
  onCreateProject: (payload: { name: string; description: string }) => Promise<void>;
  onOpenProject: (project: ProjectRecord) => Promise<void>;
}

export const HomePage = ({ projects, error, onCreateProject, onOpenProject }: HomePageProps) => {
  const [name, setName] = useState('BuildOS AI Demo');
  const [description, setDescription] = useState('AI Tech Lead workspace demo project');

  return (
    <div className="grid min-h-screen grid-cols-[1.15fr_0.85fr] bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_#020617,_#0f172a_45%,_#111827)] text-slate-100">
      <section className="flex flex-col justify-between p-12">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">BuildOS AI</p>
          <h1 className="mt-6 max-w-3xl text-6xl font-semibold leading-[1.05] tracking-tight text-white">
            A safe AI Tech Lead workspace for building software products from one bounded project folder.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Plan projects, gather requirements, generate PRDs and architecture, break work down by team, and propose local file changes with explicit approval before anything executes.
          </p>
        </div>
        <div className="grid max-w-3xl grid-cols-3 gap-4">
          {[
            'AI project planning',
            'Approval-gated file and command actions',
            'SQLite-backed project memory',
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.5)] backdrop-blur">
          <h2 className="text-2xl font-semibold text-white">Start a Project</h2>
          <p className="mt-2 text-sm text-slate-400">Create or reopen a workspace, then attach a local project folder.</p>
          {error ? (
            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              {error}
            </div>
          ) : null}
          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await onCreateProject({ name, description });
              } catch (_error) {
                // The hook exposes the environment issue through the page-level error state.
              }
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Project name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
              />
            </label>
            <button type="submit" className="w-full rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
              Create Workspace
            </button>
          </form>
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Recent projects</h3>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{projects.length}</span>
            </div>
            <div className="space-y-3">
              {projects.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No projects yet.</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project)}
                    className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-100">{project.name}</span>
                      <span className="text-xs text-slate-500">{project.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{project.description}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
