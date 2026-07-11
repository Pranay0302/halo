import { useRef } from 'react';

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function DataControls({ onExport, onImport }: {
  onExport: () => Promise<string>;
  onImport: (json: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const json = await onExport();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout-overlay-templates.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await onImport(await readText(file));
  }

  return (
    <div className="actions">
      <button className="btn" onClick={handleExport}>Export</button>
      <button className="btn" onClick={() => inputRef.current?.click()}>Import</button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={handleFile} />
    </div>
  );
}
