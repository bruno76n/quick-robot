// A screen that breaks while drawing shows a card instead of a blank page; the menu keeps working (docs/15 §5).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { t } from '../i18n/t';

interface State { errorId: string | null }

export class ErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void; resetKey?: string }, State> {
  override state: State = { errorId: null };

  static getDerivedStateFromError(): State {
    return { errorId: Math.random().toString(16).slice(2, 10) };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* the error id lets support find it; nothing technical is shown */
  }

  override componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.errorId) this.setState({ errorId: null });
  }

  override render() {
    if (!this.state.errorId) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h2>{es.screens.fatal.screenCrashed.text}</h2>
        <p className="muted">{t('screens.fatal.screenCrashed.detail', { errorId: this.state.errorId })}</p>
        <button type="button" className="btn primary" onClick={() => { this.setState({ errorId: null }); this.props.onHome?.(); }}>{es.screens.fatal.screenCrashed.buttons[0]}</button>
      </div>
    );
  }
}
