import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Guard against third-party browser extension errors (e.g. MetaMask, web3 injectors in iframes)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason?.message || String(reason || '')).toLowerCase();
    if (msg.includes('metamask') || msg.includes('ethereum') || msg.includes('failed to connect to metamask')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[Extension Guard] Ignored external Web3/MetaMask extension connection error:', reason);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = (event.message || '').toLowerCase();
    const filename = (event.filename || '').toLowerCase();
    if (
      msg.includes('metamask') ||
      msg.includes('ethereum') ||
      filename.includes('chrome-extension') ||
      filename.includes('moz-extension')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[Extension Guard] Ignored browser extension error:', event.message);
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

