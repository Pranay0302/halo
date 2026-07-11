import { useEffect, useState } from 'react';

export function KeySettings({ onChange }: { onChange: (set: boolean) => void }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void chrome.storage.local.get('apiKey').then(({ apiKey }) => setSaved(Boolean(apiKey)));
  }, []);

  async function save() {
    await chrome.storage.local.set({ apiKey: value });
    setSaved(true);
    onChange(true);
  }

  return (
    <fieldset className="field">
      <legend className="field__legend">H Company API key {saved ? '·  set' : ''}</legend>
      <label htmlFor="apikey" className="field__label">API key</label>
      <input
        id="apikey"
        className="input"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={saved ? '•••••• (set)' : 'paste key'}
      />
      <button className="btn" onClick={save}>Save key</button>
    </fieldset>
  );
}
