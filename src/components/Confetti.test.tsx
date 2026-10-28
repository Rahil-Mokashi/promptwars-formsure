import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Confetti } from './Confetti';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Confetti', () => {
  it('draws a burst on the canvas and stops', () => {
    const ctx = {
      scale: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillRect: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    let frames = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      if (frames++ < 400) cb(0);
      return frames;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const { container, unmount } = render(<Confetti />);
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    expect(ctx.fillRect).toHaveBeenCalled();
    unmount();
  });

  it('does nothing without a 2d context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = render(<Confetti />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
