export function ActivityLog({ steps, output }: { steps: string[]; output: string }) {
  if (steps.length === 0 && !output) return null;
  return (
    <section className="section">
      <h2 className="section__title">Activity</h2>
      <ol className="log">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {output && (
        <details className="log__details">
          <summary>Agent response ({output.length} chars)</summary>
          <pre className="log__pre">{output}</pre>
        </details>
      )}
    </section>
  );
}
