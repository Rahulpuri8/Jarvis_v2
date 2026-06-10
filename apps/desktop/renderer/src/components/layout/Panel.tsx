import type { PropsWithChildren, ReactNode } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const Panel = ({ title, subtitle, actions, children }: PanelProps) => (
  <section className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-slate-900/70 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur">
    <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </section>
);
