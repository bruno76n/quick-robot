// Picker (ronda-2 §12, D1): keyboard, open on create, focus after choosing.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Picker, type PickerOption } from './Picker';

afterEach(cleanup);

const OPTIONS: PickerOption[] = [
  { value: 'n', label: 'PLA Negro', hex: '#111111', group: 'En esta pieza' },
  { value: 'b', label: 'PLA Blanco', hex: '#ffffff', group: 'Los demás' },
  { value: 'r', label: 'PETG Rojo', hex: '#ff0000', hint: '900 g', group: 'Los demás' },
];

function Row({ autoOpen = false, onChange = vi.fn(), onKey = vi.fn() }: { autoOpen?: boolean; onChange?: (v: string) => void; onKey?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="frow" onKeyDown={onKey}>
      <Picker label="Filamento" value={value} options={OPTIONS} placeholder="Elige un filamento…" autoOpen={autoOpen}
        onChange={(v) => { setValue(v); onChange(v); }} next={(el) => el.closest('.frow')?.querySelector<HTMLInputElement>('input[name=g]')} />
      <input name="g" aria-label="Gramos" />
    </div>
  );
}
const trigger = () => screen.getByRole('button', { name: /^Filamento:/ });
const search = () => screen.getByRole('combobox');
const active = () => document.getElementById(search().getAttribute('aria-activedescendant') ?? '')?.textContent;

describe('Picker', () => {
  it('starts closed with the placeholder and opens with ArrowDown, the focus in its search field', () => {
    render(<Row />);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Elige un filamento…');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox', { name: 'Filamento' })).toBeTruthy();
    expect(document.activeElement).toBe(search());
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'En esta pieza' })).toBeTruthy();
  });

  it('opens with Enter or Space (a click of the button) and toggles closed again', () => {
    render(<Row />);
    fireEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('arrows move, Enter chooses and the focus goes to the grams of the row', () => {
    const onChange = vi.fn();
    render(<Row onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(active()).toContain('PLA Negro');
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'ArrowDown' }); // stays on the last one
    expect(active()).toContain('PETG Rojo');
    fireEvent.keyDown(search(), { key: 'ArrowUp' });
    expect(active()).toContain('PLA Blanco');
    fireEvent.keyDown(search(), { key: 'End' });
    expect(active()).toContain('PETG Rojo');
    fireEvent.keyDown(search(), { key: 'Home' });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('PLA Blanco');
    expect(document.activeElement).toBe(screen.getByLabelText('Gramos'));
  });

  it('typing searches (accents and case apart), and says when nothing matches', () => {
    render(<Row />);
    fireEvent.keyDown(trigger(), { key: 'p' });
    expect(search()).toHaveProperty('value', 'p');
    fireEvent.change(search(), { target: { value: 'ROJO' } });
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent)).toEqual(['PETG Rojo, 900 g']);
    fireEvent.change(search(), { target: { value: 'blánco' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.change(search(), { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('Sin resultados.');
  });

  it('Esc closes, returns the focus to the button and does not reach the dialog or drawer behind', () => {
    const onKey = vi.fn();
    render(<Row onKey={onKey} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    onKey.mockClear();
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onKey).not.toHaveBeenCalled();
  });

  it('a row created by "Agregar …" is born open with the focus inside; a click chooses', () => {
    const onChange = vi.fn();
    render(<Row autoOpen onChange={onChange} />);
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(document.activeElement).toBe(search());
    fireEvent.click(screen.getByRole('option', { name: /PETG Rojo/ }));
    expect(onChange).toHaveBeenCalledWith('r');
    expect(document.activeElement).toBe(screen.getByLabelText('Gramos'));
  });

  it('Tab or leaving the field closes it without choosing', () => {
    const onChange = vi.fn();
    render(<Row onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.blur(search(), { relatedTarget: screen.getByLabelText('Gramos') });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
