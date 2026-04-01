import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Initialize i18n (loads 'en' by default)
// initI18n()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
