import { UNAVAILABLE_MESSAGE } from './constants';

/** Live reading is not configured (no Firebase config) or not reachable. */
export class UnavailableError extends Error {
  constructor() {
    super(UNAVAILABLE_MESSAGE);
    this.name = 'UnavailableError';
  }
}

/** A document could not be read (unusable scan, unusable model output, bad file). The message is safe to show. */
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/** Gemini stayed rate-limited after every backoff. Not a problem with the document itself. */
export class RateLimitError extends ExtractionError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
