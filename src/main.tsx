import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import I18nBootstrap from '@/i18n/I18nBootstrap';
import { installChunkLoadRecovery } from '@/lib/chunkLoadRecovery';
import App from './app/App';

installChunkLoadRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nBootstrap>
      <App />
    </I18nBootstrap>
  </StrictMode>,
);
