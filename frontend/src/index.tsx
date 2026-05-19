import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TitanFeedbackProvider } from './context/TitanFeedbackContext';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TitanFeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TitanFeedbackProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

// Clean up any service worker installed by previous builds. Cache-busting
// is now handled by Cache-Control headers on index.html (no-cache) plus
// CRA's hashed asset filenames. Safe to remove once all active users have
// loaded the site at least once after this change.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
