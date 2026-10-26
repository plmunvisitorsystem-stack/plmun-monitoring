// Entry point of the React app: loads global styles and renders <App />.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './auth/AuthContext';

// Inter font is bundled locally, so it works even without internet.
// (LGU and response team pages use IBM Plex instead; see StaffLayout.jsx.)
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';

import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* LanguageProvider makes t() and the EN | TL switch available on every page */}
    <LanguageProvider>
      <BrowserRouter>
        {/* AuthProvider is inside the router because logout navigates to /login */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>,
);
