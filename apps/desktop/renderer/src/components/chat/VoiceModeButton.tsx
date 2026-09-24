import { useState } from 'react';

interface VoiceModeButtonProps {
  onTranscribed?: (text: string) => void;
}

export const VoiceModeButton = ({ onTranscribed }: VoiceModeButtonProps) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>('idle');

  const handleVoiceToggle = async () => {
    if (status === 'listening') {
      setStatus('idle');
      return;
    }

    setStatus('listening');
    try {
      if ((window as any).buildos?.executeTool) {
        const res = await (window as any).buildos.executeTool({ tool: 'voice.listen' });
        setStatus('processing');
        if (res?.data?.text && onTranscribed) {
          onTranscribed(res.data.text);
        }
      }
    } catch {
      // Fall back if voice STT service is unavailable
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'listening' && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs">
          <span className="text-[10px] font-medium animate-pulse">Listening</span>
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 h-3 bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-0.5 h-2 bg-cyan-300 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-0.5 h-3.5 bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-0.5 h-2 bg-cyan-200 animate-bounce" style={{ animationDelay: '450ms' }} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleVoiceToggle}
        title={status === 'listening' ? 'Stop Listening' : 'Voice Input (Push-to-Talk)'}
        className={`flex items-center justify-center rounded-full p-2.5 transition border ${
          status === 'listening'
            ? 'border-rose-400/50 bg-rose-500/20 text-rose-300 animate-pulse'
            : status === 'processing'
            ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
            : 'border-white/10 bg-slate-900 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200'
        }`}
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
        </svg>
      </button>
    </div>
  );
};
