import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a render error shows a friendly page instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only the message: nothing from the user's documents is ever in an error.
    console.error('FormSure render error:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fs">
        <main>
          <div className="card errbox" role="alert">
          <h1 className="h2">Something went wrong</h1>
          <p className="sub" style={{ margin: '12px auto 24px' }}>
            FormSure hit an unexpected problem. Nothing was saved or sent anywhere. Reload the page and try again; the sample applicant always works.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload FormSure</button>
          </div>
        </main>
      </div>
    );
  }
}
