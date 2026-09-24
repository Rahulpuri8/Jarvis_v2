import type { PropsWithChildren, ReactNode } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  status?: 'online' | 'offline' | 'processing';
}

export const Panel = ({ title, subtitle, actions, children, status }: PanelProps) => (
  <section className="hud-panel hud-corner flex min-h-0 flex-col hud-boot">
    <header className="flex items-center justify-between border-b border-cyan-400/10 px-4 py-3">
      <div className="flex items-center gap-3">
        {status && (
          <div className={status === 'online' ? 'status-online' : status === 'processing' ? 'status-online' : 'status-offline'} />
        )}
        <div>
          <h2 className="font-hud text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300 text-glow">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 font-mono-hud text-[10px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions}
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </section>
);
