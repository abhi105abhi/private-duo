import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import './index.css' // Agar CSS file banani ho toh

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
