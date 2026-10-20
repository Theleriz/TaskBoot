import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createEnvironment } from './platform/platform.ts';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root is missing in index.html');

createRoot(root).render(
  <StrictMode>
    <App env={createEnvironment()} />
  </StrictMode>,
);
