import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  validateImageFile,
  downscaleImage,
  MAX_UPLOAD_BYTES,
  CROP_SOURCE_MAX_EDGE,
} from '../utils/imageUtils.js';
import PersonalInfoEditor from '../components/editor/PersonalInfoEditor.jsx';
import { INITIAL_RESUME_DATA } from '../data/initialData.js';

/**
 * jsdom has no real Image and no working canvas.
 *
 * Note on setup.js: its canvas stub is guarded by
 * `if (!HTMLCanvasElement.prototype.getContext)`, but jsdom *does* define
 * getContext — it just returns null and logs "Not implemented". So that guard
 * never fires and the stub there is effectively dead. The canvas stub is
 * installed here instead, where it is actually needed.
 *
 * The Image mock below is a controllable one: it reports whatever dimensions
 * the test asks for, and can be told to fail. That lets the tests assert real
 * behaviour - that a 4000px image comes back smaller, that a 400px image comes
 * back byte-identical, that a corrupt one rejects - rather than only asserting
 * that a function was called.
 */

// jsdom's getContext returns null; replace it with a recording stub.
const realGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
  };
};
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,DOWNSCALED';

const MB = 1024 * 1024;

// Captured once, before any vi.spyOn replaces it. Calling
// document.createElement.bind(document) *inside* the mock would resolve to the
// spy itself and recurse until the stack blows.
const realCreateElement = document.createElement.bind(document);

function fileLike({ name = 'photo.jpg', type = 'image/jpeg', size = 1024 } = {}) {
  return { name, type, size };
}

/** Install an Image mock. `behaviour` decides what happens on src assignment. */
function installImageMock(behaviour) {
  const original = globalThis.Image;

  globalThis.Image = class MockImage {
    constructor() {
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.width = 0;
      this.height = 0;
      this.onload = null;
      this.onerror = null;
      this._src = '';
    }

    set src(value) {
      this._src = value;
      // Fire on the next microtask so callers can attach handlers first,
      // exactly like a real image decode.
      Promise.resolve().then(() => {
        const result = behaviour(value);
        if (result === 'error') {
          this.onerror?.(new Error('decode failed'));
          return;
        }
        this.naturalWidth = result.width;
        this.naturalHeight = result.height;
        this.width = result.width;
        this.height = result.height;
        this.onload?.();
      });
    }

    get src() {
      return this._src;
    }
  };

  return () => {
    globalThis.Image = original;
  };
}

describe('validateImageFile', () => {
  it('rejects null without throwing', () => {
    const res = validateImageFile(null);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/choose an image/i);
  });

  it('rejects undefined without throwing', () => {
    const res = validateImageFile(undefined);
    expect(res.ok).toBe(false);
    expect(typeof res.error).toBe('string');
  });

  it('rejects a plain object that is not a File', () => {
    const res = validateImageFile({});
    expect(res.ok).toBe(false);
    // An object with no `type` fails the MIME check, which is the right
    // message: the user picked something that is not an image.
    expect(res.error).toMatch(/file type/i);
  });

  it('rejects a zero-byte image', () => {
    const res = validateImageFile(fileLike({ size: 0 }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/empty/i);
  });

  it('rejects a non-image MIME type', () => {
    const res = validateImageFile(fileLike({ name: 'resume.pdf', type: 'application/pdf' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/file type/i);
  });

  it('rejects a file with no MIME type at all', () => {
    const res = validateImageFile(fileLike({ type: '' }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/file type/i);
  });

  it('rejects a file over the limit and names the actual size', () => {
    const size = 24.3 * MB;
    const res = validateImageFile(fileLike({ size }));
    expect(res.ok).toBe(false);
    // The whole point of the message: the user must see the real size.
    expect(res.error).toContain('24.3 MB');
    expect(res.error).toMatch(/under 10 MB/i);
  });

  it('rejects a 50 MB phone photo', () => {
    const res = validateImageFile(fileLike({ size: 50 * MB }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('50.0 MB');
  });

  it('accepts a file exactly at the limit', () => {
    const res = validateImageFile(fileLike({ size: MAX_UPLOAD_BYTES }));
    expect(res.ok).toBe(true);
  });

  it('rejects one byte over the limit', () => {
    const res = validateImageFile(fileLike({ size: MAX_UPLOAD_BYTES + 1 }));
    expect(res.ok).toBe(false);
  });

  it('accepts a valid small image', () => {
    const res = validateImageFile(fileLike({ size: 200 * 1024 }));
    expect(res.ok).toBe(true);
  });

  it('accepts every common image type', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateImageFile(fileLike({ type, size: 1024 })).ok).toBe(true);
    }
  });
});

describe('downscaleImage', () => {
  let restoreImage;

  afterEach(() => {
    restoreImage?.();
    restoreImage = undefined;
  });

  it('returns the original data URL unchanged when already small', async () => {
    restoreImage = installImageMock(() => ({ width: 400, height: 300 }));
    const original = 'data:image/png;base64,SMALLIMAGE';

    const out = await downscaleImage(original, 1024);

    // Identity, not just equality: no re-encode should have happened at all.
    expect(out).toBe(original);
  });

  it('scales a large image down so its longest edge fits maxEdge', async () => {
    restoreImage = installImageMock(() => ({ width: 4000, height: 3000 }));

    const out = await downscaleImage('data:image/jpeg;base64,BIG', 1024);

    expect(out).not.toBe('data:image/jpeg;base64,BIG');
    expect(out.startsWith('data:image/jpeg')).toBe(true);
  });

  it('writes the correctly scaled canvas dimensions', async () => {
    restoreImage = installImageMock(() => ({ width: 4000, height: 3000 }));

    const created = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag);
      if (tag === 'canvas') created.push(el);
      return el;
    });

    await downscaleImage('data:image/jpeg;base64,BIG', 1024);

    expect(created).toHaveLength(1);
    // 4000x3000 scaled so the longest edge is 1024 -> 1024x768.
    expect(created[0].width).toBe(1024);
    expect(created[0].height).toBe(768);

    document.createElement.mockRestore();
  });

  it('honours a custom maxEdge', async () => {
    restoreImage = installImageMock(() => ({ width: 2000, height: 1000 }));

    const created = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag);
      if (tag === 'canvas') created.push(el);
      return el;
    });

    await downscaleImage('data:image/jpeg;base64,BIG', 500);

    expect(created[0].width).toBe(500);
    expect(created[0].height).toBe(250);

    document.createElement.mockRestore();
  });

  it('rejects on a corrupt image instead of hanging', async () => {
    restoreImage = installImageMock(() => 'error');

    await expect(downscaleImage('data:image/jpeg;base64,CORRUPT')).rejects.toThrow(
      /could not be read|corrupt/i
    );
  });

  it('rejects a zero-dimension image rather than drawing to a 0x0 canvas', async () => {
    restoreImage = installImageMock(() => ({ width: 0, height: 0 }));

    await expect(downscaleImage('data:image/jpeg;base64,EMPTY')).rejects.toThrow(
      /dimensions/i
    );
  });

  it('rejects empty or non-string input without hanging', async () => {
    await expect(downscaleImage('')).rejects.toThrow(/no image data/i);
    await expect(downscaleImage(null)).rejects.toThrow(/no image data/i);
    await expect(downscaleImage(undefined)).rejects.toThrow(/no image data/i);
  });

  it('does not treat an exactly-maxEdge image as needing a resize', async () => {
    restoreImage = installImageMock(() => ({ width: 1024, height: 768 }));
    const original = 'data:image/jpeg;base64,EXACT';

    const out = await downscaleImage(original, 1024);

    expect(out).toBe(original);
  });
});

describe('constants', () => {
  it('MAX_UPLOAD_BYTES is 10 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it('the crop source edge matches what the crop modal can zoom into', () => {
    expect(CROP_SOURCE_MAX_EDGE).toBe(1024);
  });
});

// ---- PersonalInfoEditor wiring ----

/**
 * Integration check for the upload guard: the wiring in PersonalInfoEditor,
 * not just the util it calls. Asserts the observable outcome a user gets —
 * an inline message for a rejected file, and no crop modal.
 *
 * Reuses the MB constant declared at the top of this file.
 */

function makeFile({ name = 'photo.jpg', type = 'image/jpeg', size = 1024 } = {}) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function renderEditor() {
  const onChange = vi.fn();
  const utils = render(
    <PersonalInfoEditor data={JSON.parse(JSON.stringify(INITIAL_RESUME_DATA.personalInfo))} onChange={onChange} />
  );
  // The first hidden input is the photo picker.
  const input = utils.container.querySelector('input[type="file"]');
  return { ...utils, input, onChange };
}

describe('PersonalInfoEditor photo upload guard', () => {
  it('shows an inline error for an oversized file and does not open the crop modal', async () => {
    const { input } = renderEditor();

    fireEvent.change(input, { target: { files: [makeFile({ size: 24.3 * MB })] } });

    await waitFor(() => {
      expect(screen.getByText(/24\.3 MB/)).toBeInTheDocument();
    });
    expect(screen.getByText(/under 10 MB/i)).toBeInTheDocument();
    // Crop modal must not have opened.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('announces the error through an aria-live region', async () => {
    const { input, container } = renderEditor();

    fireEvent.change(input, { target: { files: [makeFile({ size: 50 * MB })] } });

    await waitFor(() => expect(screen.getByText(/50\.0 MB/)).toBeInTheDocument());

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live.textContent).toMatch(/50\.0 MB/);
  });

  it('shows an error for a non-image file', async () => {
    const { input } = renderEditor();

    fireEvent.change(input, {
      target: { files: [makeFile({ name: 'cv.pdf', type: 'application/pdf' })] },
    });

    await waitFor(() => expect(screen.getByText(/file type/i)).toBeInTheDocument());
  });

  it('shows an error for a zero-byte file', async () => {
    const { input } = renderEditor();

    fireEvent.change(input, { target: { files: [makeFile({ size: 0 })] } });

    await waitFor(() => expect(screen.getByText(/empty/i)).toBeInTheDocument());
  });

  it('resets the file input so re-selecting the same file works', async () => {
    const { input } = renderEditor();
    const file = makeFile({ size: 24.3 * MB });

    Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\photo.jpg', writable: true });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/24\.3 MB/)).toBeInTheDocument());
    // The handler clears it, so picking the same file fires change again.
    expect(input.value).toBe('');
  });
});
