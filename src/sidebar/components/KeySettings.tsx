import { useEffect, useState } from 'react';

export function KeySettings({ onChange }: { onChange: (set: boolean) => void }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  // Load the persisted key on open so it pertains across close/reopen.
  useEffect(() => {
    void chrome.storage.local.get('apiKey').then(({ apiKey }) => {
      if (typeof apiKey === 'string' && apiKey) {
        setValue(apiKey);
        setSaved(true);
      }
    });
  }, []);

  async function save() {
    const key = value.trim();
    if (!key) return; // never overwrite a stored key with an empty value
    await chrome.storage.local.set({ apiKey: key });
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
        placeholder="paste key"
      />
      <button className="btn" disabled={!value.trim()} onClick={save}>Save key</button>
    </fieldset>
  );
}
