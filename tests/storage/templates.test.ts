import { describe, it, expect, beforeEach } from 'vitest';
import { listTemplates, saveTemplate, deleteTemplate, exportTemplates, importTemplates } from '../../src/storage/templates';
import { __resetChromeStore } from '../setup';
import type { Template } from '../../src/shared/types';

function makeTemplate(over: Partial<Template> = {}): Template {
  return {
    id: over.id ?? 't1', name: 'My Gmail', domain: over.domain ?? 'mail.google.com',
    presetBase: 'minimal', instructionHistory: ['hide ads'],
    ruleSet: { version: 1, ops: [{ op: 'hide', selector: '.ad' }], globalCss: '' },
    createdAt: 1, updatedAt: 1, ...over,
  };
}

describe('template storage', () => {
  beforeEach(() => __resetChromeStore());

  it('saves and lists by domain', async () => {
    await saveTemplate(makeTemplate());
    await saveTemplate(makeTemplate({ id: 't2', domain: 'linkedin.com' }));
    const gmail = await listTemplates('mail.google.com');
    expect(gmail.map((t) => t.id)).toEqual(['t1']);
  });

  it('updates an existing template in place', async () => {
    await saveTemplate(makeTemplate());
    await saveTemplate(makeTemplate({ name: 'Renamed' }));
    const list = await listTemplates('mail.google.com');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Renamed');
  });

  it('deletes by id', async () => {
    await saveTemplate(makeTemplate());
    await deleteTemplate('t1');
    expect(await listTemplates('mail.google.com')).toHaveLength(0);
  });

  it('round-trips via export/import', async () => {
    await saveTemplate(makeTemplate());
    const json = await exportTemplates();
    __resetChromeStore();
    const res = await importTemplates(json);
    expect(res.imported).toBe(1);
    expect(await listTemplates('mail.google.com')).toHaveLength(1);
  });

  it('skips invalid rule sets on import', async () => {
    const bad = JSON.stringify([{ ...makeTemplate(), ruleSet: { version: 1, ops: [{ op: 'nuke' }], globalCss: '' } }]);
    const res = await importTemplates(bad);
    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(1);
  });
});
