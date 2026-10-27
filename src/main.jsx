import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@ume/ui/components/ui/button';
import App from './App';
import AuthGate from './components/Auth';
import { MotionProvider } from '@ume/ui/components/patterns/MotionProvider';
import { ToastProvider } from '@ume/ui/components/ui/toast';
import { installScrollingFlag } from '@ume/ui/lib/scrolling';
import './index.css';

installScrollingFlag();

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="font-heading font-medium text-xl text-balance">Something went wrong on this screen</h1>
          <p className="mx-auto mt-2 max-w-[40ch] text-balance text-sm text-muted-foreground">Your workspace is saved and nothing was lost. Reload to continue.</p>
          <pre className="mt-4 whitespace-pre-wrap text-xs text-destructive-foreground">{String(this.state.error?.message || this.state.error)}</pre>
          <Button className="mt-5" onClick={() => { location.hash = '#/'; location.reload(); }}>Reload</Button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <MotionProvider>
    <ToastProvider>
      <ErrorBoundary>
        <AuthGate>
          <App />
        </AuthGate>
      </ErrorBoundary>
    </ToastProvider>
  </MotionProvider>,
);
