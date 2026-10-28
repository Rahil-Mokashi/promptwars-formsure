import type { Screen } from '../hooks/useFlow';
import type { Lang } from '../core/types';
import { ShieldIcon } from './icons';

const STEP_OF: Partial<Record<Screen, number>> = { scheme: 1, upload: 2, audit: 3, report: 4, ready: 4 };
const STEPS = ['Scheme', 'Upload', 'Check', 'Report'] as const;

/** The three languages for fixes: code, button label and English name. */
export const LANGS: readonly { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'mr', label: 'मराठी', name: 'Marathi' },
  { code: 'hi', label: 'हिंदी', name: 'Hindi' },
];

/** Props of {@link Header}. */
export interface HeaderProps {
  screen: Screen;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onHome: () => void;
}

/** Sticky glass header: brand, progress steps (after the landing page) and the language toggle. */
export function Header({ screen, lang, onLang, onHome }: HeaderProps) {
  const current = STEP_OF[screen] ?? 0;
  return (
    <header className="top">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <div className="wrap topin">
        <button className="brand" onClick={onHome} aria-label="FormSure, back to start">
          <span className="logo">
            <ShieldIcon />
          </span>
          <span className="brandname">FormSure</span>
        </button>
        {screen !== 'landing' && (
          <nav className="steps" aria-label="Progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const cls = n === current ? 'on' : n < current ? 'done' : '';
              return (
                <div
                  key={label}
                  className={`step ${cls}`}
                  aria-current={n === current ? 'step' : undefined}
                  aria-label={`Step ${n}: ${label}`}
                >
                  <span className="stepnum">{n < current ? '✓' : n}</span>
                  <span className="steplabel">{label}</span>
                </div>
              );
            })}
          </nav>
        )}
        <div className="langs" role="group" aria-label="Language for fixes">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`lang ${l.code === lang ? 'on' : ''}`}
              onClick={() => {
                onLang(l.code);
              }}
              aria-pressed={l.code === lang}
              lang={l.code}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
