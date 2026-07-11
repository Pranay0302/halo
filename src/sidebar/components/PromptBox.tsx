import { useState } from 'react';

export function PromptBox({ onSubmit, disabled }: { onSubmit: (text: string) => void; disabled?: boolean }) {
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
        placeholder="e.g. hide the right sidebar and enlarge fonts"
      />
      <button className="btn btn--primary" disabled={disabled || !text.trim()} onClick={() => onSubmit(text.trim())}>
        Generate
      </button>
    </section>
  );
}
