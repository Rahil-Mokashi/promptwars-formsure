import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no matchMedia. Test files set globalThis.__REDUCE_MOTION__ before rendering.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches:
      query.includes('prefers-reduced-motion') &&
      (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ === true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }),
});

import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// jsdom has no image decoding or canvas. These stubs stand in for the browser so the upload pipeline can run in tests;
// uploadPipeline.test.ts exercises the pipeline logic with its own fakes.
import { imageHeader } from './test/files';

Object.defineProperty(globalThis, 'createImageBitmap', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve({ width: 100, height: 100, close: () => undefined }),
});
HTMLCanvasElement.prototype.getContext = (() => ({
  drawImage: () => undefined,
})) as unknown as HTMLCanvasElement['getContext'];
HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
  callback(new Blob([imageHeader(type ?? 'image/png')], { type }));
};
