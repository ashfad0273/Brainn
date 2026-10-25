import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store';
import './index.css';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Something went wrong on this screen</h1>
          <p className="text-sm text-neutral-500 mt-2">Your workspace is saved and nothing was lost. Reload to continue.</p>
          <pre className="text-xs text-rose-300/80 mt-4 whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => { location.hash = '#/'; location.reload(); }} className="mt-5 px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium">Reload</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
    </StoreProvider>
  </ErrorBoundary>,
);
