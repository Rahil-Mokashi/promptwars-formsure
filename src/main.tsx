import './core/zodConfig';
import { domAnimation, LazyMotion } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {/* LazyMotion + m.* components: only the DOM animation features are bundled, not the full motion runtime. */}
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </StrictMode>,
);
