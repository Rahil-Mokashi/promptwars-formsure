import { UNAVAILABLE_MESSAGE } from '../../core/constants';

/** Props of {@link UploadNotices}. */
export interface UploadNoticesProps {
  /** Sample mode: no consent or privacy notices are needed. */
  isSample: boolean;
  liveAvailable: boolean;
  consent: boolean;
  onConsent: (consent: boolean) => void;
  error: string | null;
}

/** The consent box and privacy tip (live mode), the "unavailable" notice, and any blocking error. */
export function UploadNotices({ isSample, liveAvailable, consent, onConsent, error }: UploadNoticesProps) {
  const live = !isSample && liveAvailable;
  return (
    <>
      {live && (
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            aria-describedby="privacy-note"
            onChange={(e) => {
              onConsent(e.target.checked);
            }}
          />
          <span>Your documents are sent to Google Gemini via Firebase only to read them. Nothing is stored.</span>
        </label>
      )}
      {live && (
        <p className="slotnote privacynote" id="privacy-note">
          <b>Privacy tip:</b> the whole scan is sent, including your Aadhaar number and QR code. FormSure only needs the
          name and date of birth, so you can cover the first 8 digits of the Aadhaar number and the QR code before
          uploading. Any 12-digit number FormSure shows back is masked as XXXX XXXX 1234.
        </p>
      )}
      {!isSample && !liveAvailable && (
        <p className="errnote" role="status">
          {UNAVAILABLE_MESSAGE}
        </p>
      )}
      {error && (
        <p className="errnote" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
