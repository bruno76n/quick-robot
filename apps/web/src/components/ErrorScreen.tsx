import { Component, type ErrorInfo, type ReactNode } from 'react';
import { es } from '../i18n/es';

/** What the person sees when a screen fails (docs/11 · A10): a message and a way out, never a blank page. */
export function ErrorScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-[520px] justify-items-start gap-3 px-6 py-16">
      <h1>{es.app.crashTitle}</h1>
      <p className="text-ink-2">{es.app.crashText}</p>
      <button type="button" className="min-h-[38px] cursor-pointer rounded-btn border border-btn bg-btn px-[14px] py-2 font-medium text-btn-ink" onClick={onRetry ?? (() => window.location.reload())}>
        {es.app.reload}
      </button>
    </div>
  );
}

/** Catches render errors anywhere below it. Details stay in the console, not on screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}
