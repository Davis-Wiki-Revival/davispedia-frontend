import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CowlenderApp } from './CowlenderApp';
import './cowlender.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function mountCowlender(): void {
  const mountPoint = document.getElementById('cowlender-root');
  if (!mountPoint || mountPoint.dataset.cowlenderMounted === 'true') {
    return;
  }

  const configuredBaseUrl = window.mw?.config.get('wgCowlenderRestBaseUrl');
  const apiBaseUrl = mountPoint.dataset.cowlenderApi
    || (typeof configuredBaseUrl === 'string' ? configuredBaseUrl : '');

  mountPoint.dataset.cowlenderMounted = 'true';
  mountPoint.replaceChildren();

  if (!apiBaseUrl) {
    mountPoint.textContent = 'The Cowlender API URL is not configured.';
    return;
  }

  createRoot(mountPoint).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CowlenderApp apiBaseUrl={apiBaseUrl} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountCowlender, { once: true });
} else {
  mountCowlender();
}
