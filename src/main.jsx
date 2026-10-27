import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@ume/ui/components/session/ErrorBoundary';
import App from './App';
import AuthGate from './components/Auth';
import { MotionProvider } from '@ume/ui/components/patterns/MotionProvider';
import { ToastProvider } from '@ume/ui/components/ui/toast';
import { installScrollingFlag } from '@ume/ui/lib/scrolling';
import './index.css';

installScrollingFlag();

createRoot(document.getElementById('root')).render(
  <MotionProvider>
    <ToastProvider>
      {/* "Project Brain couldn't start"; Reload goes home first, so a broken deep link can't loop. */}
      <ErrorBoundary fullPage appName="Project Brain" onReload={() => { location.hash = '#/'; location.reload(); }}>
        <AuthGate>
          <App />
        </AuthGate>
      </ErrorBoundary>
    </ToastProvider>
  </MotionProvider>,
);
