let isMuted = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export const isVoiceResponseMuted = (): boolean => isMuted;

export const setVoiceResponseMuted = (muted: boolean): void => {
  isMuted = muted;
  if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const toggleVoiceResponseMuted = (): boolean => {
  setVoiceResponseMuted(!isMuted);
  return isMuted;
};

/**
 * Clean text for natural speech synthesis:
 * - Replace code blocks with polite conversational announcements
 * - Strip markdown headers, bold, bullets
 */
export const prepareSpokenText = (raw: string): string => {
  if (!raw) return '';

  let cleaned = raw;

  // Replace code blocks with spoken summary
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' I have prepared the code snippet for you in the console, Sir. ');

  // Replace inline code `code`
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Strip markdown bold, italics, headers
  cleaned = cleaned.replace(/[*#_~]/g, '');

  // Strip markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Clean numbered lists or bullet points (e.g. "1. List Installed Apps: - To see" -> "List Installed Apps: To see")
  cleaned = cleaned.replace(/^\s*\d+\.\s*/gm, '');
  cleaned = cleaned.replace(/^[•\-\*]\s*/gm, '');

  // Normalize extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If text is long, speak only the primary 1-2 sentences cleanly
  if (cleaned.length > 200) {
    const sentences = cleaned.split(/(?<=[.?!])\s+/);
    if (sentences.length > 1) {
      cleaned = sentences.slice(0, 2).join(' ') + ' Further details are displayed on your console, Sir.';
    }
  }

  return cleaned;
};

/**
 * Speak text aloud using either Web Speech API or Python pyttsx3 fallback
 */
export const speakJarvisVoice = (
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
  }
): void => {
  if (isMuted) return;

  const spoken = prepareSpokenText(text);
  if (!spoken) return;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spoken);
    currentUtterance = utterance;

    // Jarvis speech tuning: refined, slightly fast, calm pitch
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural English / British voices reminiscent of Jarvis
    const preferredVoice = voices.find(
      (v) =>
        v.name.includes('George') ||
        v.name.includes('Daniel') ||
        v.name.includes('Oliver') ||
        v.name.includes('David') ||
        v.name.includes('Natural') ||
        v.lang === 'en-GB' ||
        v.lang.startsWith('en')
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (callbacks?.onStart) {
      utterance.onstart = () => callbacks.onStart?.();
    }

    utterance.onend = () => {
      callbacks?.onEnd?.();
      currentUtterance = null;
    };

    utterance.onerror = () => {
      callbacks?.onEnd?.();
      currentUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
    return;
  }

  // Fallback: Offline Python voice.speak tool
  if ((window as any)?.buildos?.executeTool) {
    callbacks?.onStart?.();
    void (window as any).buildos
      .executeTool({
        tool: 'voice.speak',
        arguments: { text: spoken },
      })
      .finally(() => {
        callbacks?.onEnd?.();
      });
  }
};

export const stopJarvisVoice = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
};
