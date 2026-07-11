import type { Template } from '../shared/types';
import { validateRuleSet } from '../rules/schema';

const KEY = 'templates';

async function readAll(): Promise<Template[]> {
  const res = await chrome.storage.local.get(KEY);
  return (res[KEY] as Template[] | undefined) ?? [];
}

async function writeAll(all: Template[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: all });
}

export async function listTemplates(domain: string): Promise<Template[]> {
  return (await readAll()).filter((t) => t.domain === domain);
}

export async function saveTemplate(t: Template): Promise<void> {
  const all = await readAll();
  const i = all.findIndex((x) => x.id === t.id);
  if (i >= 0) all[i] = t;
  else all.push(t);
  await writeAll(all);
}

export async function deleteTemplate(id: string): Promise<void> {
  await writeAll((await readAll()).filter((t) => t.id !== id));
}

export async function exportTemplates(): Promise<string> {
  return JSON.stringify(await readAll(), null, 2);
}

export async function importTemplates(json: string): Promise<{ imported: number; skipped: number }> {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { imported: 0, skipped: 0 }; }
  if (!Array.isArray(parsed)) return { imported: 0, skipped: 0 };

  const all = await readAll();
  let imported = 0;
  let skipped = 0;
  for (const entry of parsed as Template[]) {
    if (!entry || !validateRuleSet(entry.ruleSet).ok) { skipped++; continue; }
    const i = all.findIndex((x) => x.id === entry.id);
    if (i >= 0) all[i] = entry;
    else all.push(entry);
    imported++;
  }
  await writeAll(all);
  return { imported, skipped };
}
