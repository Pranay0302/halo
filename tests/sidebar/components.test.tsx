import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetGallery } from '../../src/sidebar/components/PresetGallery';
import { PromptBox } from '../../src/sidebar/components/PromptBox';
import { TemplateList } from '../../src/sidebar/components/TemplateList';
import { StatusBar } from '../../src/sidebar/components/StatusBar';
import type { Template } from '../../src/shared/types';

describe('sidebar components', () => {
  it('PresetGallery fires onApply with the preset id', () => {
    const onApply = vi.fn();
    render(<PresetGallery presets={[{ id: 'dark', name: 'Dark', ruleSet: { version: 1, ops: [], globalCss: '' } }]} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(onApply).toHaveBeenCalledWith('dark');
  });

  it('PromptBox submits typed text', () => {
    const onSubmit = vi.fn();
    render(<PromptBox onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hide ads' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(onSubmit).toHaveBeenCalledWith('hide ads');
  });

  it('TemplateList renders and applies/deletes', () => {
    const t: Template = { id: 't1', name: 'My Gmail', domain: 'mail.google.com', presetBase: null, instructionHistory: [], ruleSet: { version: 1, ops: [], globalCss: '' }, createdAt: 1, updatedAt: 1 };
    const onApply = vi.fn(); const onDelete = vi.fn();
    render(<TemplateList templates={[t]} onApply={onApply} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /apply my gmail/i }));
    expect(onApply).toHaveBeenCalledWith(t);
    fireEvent.click(screen.getByRole('button', { name: /delete my gmail/i }));
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('StatusBar shows the message', () => {
    render(<StatusBar status={{ kind: 'error', message: 'boom' }} />);
    expect(screen.getByText('boom')).toBeTruthy();
  });
});
