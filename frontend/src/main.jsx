import React from 'react'
import ReactDOM from 'react-dom/client'
import './api/axios'
import App from './App.jsx'
import './index.css'
import './mobile-density.css'
import './pages/LandingPolish.css'
import './pages/LandingMotion.css'
import ToastProvider from './components/ui/ToastProvider.jsx'
import CanonicalLinkGuard from './components/seo/CanonicalLinkGuard.jsx'
import ExpenseManagerPortal from './components/analytics/ExpenseManagerPortal.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('VIN Matrix service worker registration failed:', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider><CanonicalLinkGuard /><ExpenseManagerPortal /><App /></ToastProvider>
  </React.StrictMode>,
)
