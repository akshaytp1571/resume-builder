import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalShell from '../components/ui/ModalShell.jsx';

/**
 * ModalShell is the accessibility contract for all eight dialogs. Every one of
 * these behaviours used to be per-modal hand-rolled code that drifted; this
 * file is what stops it drifting again.
 */

// jsdom always reports offsetParent === null, which makes ModalShell's
// visibility filter drop every control and silently disable the focus trap.
// Stub it to the real parent so the trap sees a realistic focusable list.
let realOffsetParent;
beforeEach(() => {
  realOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
});
afterEach(() => {
  if (realOffsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', realOffsetParent);
  else delete HTMLElement.prototype.offsetParent;
});

function renderShell(props = {}) {
  return render(
    <ModalShell onClose={props.onClose ?? (() => {})} labelledBy="shell-title" {...props}>
      <h2 id="shell-title">Dialog Title</h2>
      <button type="button">First</button>
      <button type="button">Middle</button>
      <button type="button">Last</button>
    </ModalShell>
  );
}

describe('ModalShell', () => {
  it('renders its children', () => {
    renderShell();
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
  });

  it('is announced as a modal dialog', () => {
    renderShell();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('resolves aria-labelledby to real text', () => {
    renderShell();
    // getByRole's `name` option runs the real accessible-name computation, so
    // this fails if the id points at nothing.
    expect(screen.getByRole('dialog', { name: 'Dialog Title' })).toBeInTheDocument();
  });

  it('wires aria-describedby when given', () => {
    render(
      <ModalShell onClose={() => {}} labelledBy="t" describedBy="d">
        <h2 id="t">T</h2>
        <p id="d">Description text</p>
      </ModalShell>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'd');
    expect(document.getElementById('d')).toHaveTextContent('Description text');
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    renderShell({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus inside on mount', () => {
    renderShell();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveTextContent('First');
  });

  it('returns focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderShell();
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('wraps focus forward from the last control to the first', () => {
    renderShell();
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toHaveTextContent('First');
  });

  it('wraps focus backward from the first control to the last', () => {
    renderShell();
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toHaveTextContent('Last');
  });

  it('does not hijack Tab in the middle of the trap', () => {
    renderShell();
    const middle = screen.getByRole('button', { name: 'Middle' });
    middle.focus();
    // No preventDefault and no focus move: the browser advances naturally.
    const notCancelled = fireEvent.keyDown(document, { key: 'Tab' });
    expect(notCancelled).toBe(true);
    expect(document.activeElement).toBe(middle);
  });

  it('closes when the backdrop is moused down', () => {
    const onClose = vi.fn();
    renderShell({ onClose });
    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a control inside the panel is moused down', () => {
    const onClose = vi.fn();
    renderShell({ onClose });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'First' }));
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('honours closeOnBackdrop={false}', () => {
    const onClose = vi.fn();
    renderShell({ onClose, closeOnBackdrop: false });
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll while open and restores the previous value on unmount', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderShell();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('restores an empty body overflow to empty, not to the literal "hidden"', () => {
    document.body.style.overflow = '';
    const { unmount } = renderShell();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('applies the zIndex and className it is given', () => {
    renderShell({ zIndex: 'z-[70]', className: 'max-w-lg' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-lg');
    expect(dialog.parentElement.className).toContain('z-[70]');
  });

  it('still focuses the dialog itself when it contains no controls', () => {
    render(
      <ModalShell onClose={() => {}} labelledBy="bare">
        <h2 id="bare">No controls here</h2>
      </ModalShell>
    );
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
  });

  it('does not throw on Escape with no onClose handler', () => {
    render(
      <ModalShell labelledBy="x">
        <h2 id="x">X</h2>
      </ModalShell>
    );
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
  });
});
