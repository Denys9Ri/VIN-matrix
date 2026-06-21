import React from 'react'
import ReactDOM from 'react-dom/client'
import './api/axios'
import App from './App.jsx'
import './index.css'
import './pages/LandingPolish.css'
import './pages/LandingMotion.css'
import ToastProvider from './components/ui/ToastProvider.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider><App /></ToastProvider>
  </React.StrictMode>,
)