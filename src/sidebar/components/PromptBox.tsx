import { useState } from 'react';

export function PromptBox({ onSubmit, disabled, busy }: { onSubmit: (text: string) => void; disabled?: boolean; busy?: boolean }) {
  const [text, setText] = useState('');
  return (
    <section className="section">
      <h2 className="section__title">Refine with the agent</h2>
      <textarea
        aria-label="instruction"
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={busy}
        placeholder="e.g. hide the right sidebar and enlarge fonts"
      />
      <button
        className="btn btn--primary"
        disabled={disabled || busy || !text.trim()}
        aria-busy={busy || undefined}
        onClick={() => onSubmit(text.trim())}
      >
        {busy ? <><span className="spinner" aria-hidden="true" />Working…</> : 'Generate'}
      </button>
    </section>
  );
}
