export function ActivityLog({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="section">
      <h2 className="section__title">Activity</h2>
      <ol className="log">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </section>
  );
}
