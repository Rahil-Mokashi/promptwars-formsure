/** Largest upload accepted, in bytes (5 MB). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** MIME types accepted for upload. */
export const ALLOWED_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Message shown when live reading is not configured or not reachable. */
export const UNAVAILABLE_MESSAGE = 'Live reading unavailable, try the sample applicant';

/** Default Gemini model; override with VITE_GEMINI_MODEL. */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** How long one Gemini request may take before it counts as a timeout. */
export const GEMINI_TIMEOUT_MS = 30_000;

/** Seconds to wait before each retry after a 429 (free-tier rate limit): 10 s, 20 s, then 40 s. */
export const RATE_LIMIT_BACKOFF_SECONDS: readonly number[] = [10, 20, 40];

/** A timed-out request is retried this many times (schema errors are never retried). */
export const TIMEOUT_RETRIES = 1;

/** Files read at the same time. */
export const READ_CONCURRENCY = 2;

/** Time between the start of one file read and the start of the next, so the free-tier request rate stays low. */
export const READ_STAGGER_MS = 2000;

/** Client-side limiter: at most this many Gemini calls in any rolling window. */
export const MAX_REQUESTS_PER_WINDOW = 8;

/** Length of the limiter's rolling window (one minute). */
export const RATE_WINDOW_MS = 60_000;

/** How many bytes of a file are read to recognise its real type (magic bytes). */
export const MAGIC_BYTES_LENGTH = 12;

/** Longest full name the form accepts. */
export const NAME_MAX_LENGTH = 100;

/** Earliest plausible birth year. */
export const FIRST_BIRTH_YEAR = 1900;

/** Milliseconds in a second, used by countdowns. */
export const SECOND_MS = 1000;

/** Most files that can be selected at once. */
export const MAX_FILES = 10;

/** Largest total size of all selected files, in bytes (25 MB). */
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/** Largest image width or height accepted, in pixels. */
export const MAX_IMAGE_SIDE_PX = 6000;

/** Images whose long side is above this are scaled down to it before sending (never below: scans must stay readable). */
export const DOWNSCALE_ABOVE_PX = 2400;

/** Most pages a PDF may have. */
export const MAX_PDF_PAGES = 10;

/** Quality used when re-encoding JPEG and WebP images. */
export const REENCODE_QUALITY = 0.92;

/** How many bytes at the end of a PDF are searched for the end-of-file marker. */
export const PDF_TAIL_BYTES = 2048;

/** A device may make this many Gemini calls per day (kept in memory only: nothing is written to browser storage). */
export const MAX_REQUESTS_PER_DAY = 60;

/** Length of the daily window. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Key under which the limiter keeps call timestamps (numbers only) in sessionStorage. */
export const LIMITER_STORAGE_KEY = 'formsure.limiter.v1';
