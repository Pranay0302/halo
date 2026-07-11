import type { Preset } from '../../shared/types';

export function PresetGallery({ presets, onApply }: { presets: Preset[]; onApply: (id: string) => void }) {
  return (
    <section className="section">
      <h2 className="section__title">Presets</h2>
      <div className="chips">
        {presets.map((p) => (
          <button key={p.id} className="btn" onClick={() => onApply(p.id)}>{p.name}</button>
        ))}
      </div>
    </section>
  );
}
