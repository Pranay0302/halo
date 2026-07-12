import { useState } from 'react';
import { useAppState } from './state/useAppState';
import { KeySettings } from './components/KeySettings';
import { PresetGallery } from './components/PresetGallery';
import { PromptBox } from './components/PromptBox';
import { TemplateList } from './components/TemplateList';
import { DataControls } from './components/DataControls';
import { ActivityLog } from './components/ActivityLog';
import { StatusBar } from './components/StatusBar';

export function App() {
  const s = useAppState();
  const [keySet, setKeySet] = useState(s.apiKeySet);

  return (
    <main className="app">
      <header>
        <h1 className="app__title">Layout Overlay</h1>
        <p className="app__site">Site: <strong>{s.domain || '—'}</strong></p>
      </header>

      <KeySettings onChange={setKeySet} />

      <PresetGallery presets={s.presets} onApply={s.applyPreset} />

      <PromptBox onSubmit={s.generate} disabled={!keySet && !s.apiKeySet} />

      <div className="actions">
        <button className="btn" onClick={() => { const n = prompt('Template name?'); if (n) void s.saveCurrent(n); }}>
          Save template
        </button>
        <button className="btn" onClick={s.reset}>Reset page</button>
      </div>

      <section className="section">
        <h2 className="section__title">Saved for this site</h2>
        <TemplateList templates={s.templates} onApply={s.applyTemplate} onDelete={s.deleteTemplate} />
        <DataControls onExport={s.exportAll} onImport={s.importAll} />
      </section>

      <StatusBar status={s.status} />

      <ActivityLog steps={s.activity} />
    </main>
  );
}
