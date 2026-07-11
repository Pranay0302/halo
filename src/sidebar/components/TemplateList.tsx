import type { Template } from '../../shared/types';

export function TemplateList({ templates, onApply, onDelete }: {
  templates: Template[]; onApply: (t: Template) => void; onDelete: (id: string) => void;
}) {
  if (templates.length === 0) return <p className="empty">No saved templates for this site yet.</p>;
  return (
    <ul className="tlist">
      {templates.map((t) => (
        <li key={t.id} className="tlist__row">
          <button className="btn tlist__apply" aria-label={`apply ${t.name}`} onClick={() => onApply(t)}>{t.name}</button>
          <button className="btn btn--icon" aria-label={`delete ${t.name}`} onClick={() => onDelete(t.id)}>✕</button>
        </li>
      ))}
    </ul>
  );
}
