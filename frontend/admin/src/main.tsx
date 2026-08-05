import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const dsn = import.meta.env.VITE_SENTRY_DSN || import.meta.env.REACT_APP_SENTRY_DSN;
if (dsn) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
    })
    .catch(() => undefined);
}

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
