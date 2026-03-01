import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Ensure no default margins/padding on root elements
const root = document.getElementById('root') as HTMLElement
if (root) {
  root.style.margin = '0'
  root.style.padding = '0'
  root.style.width = '100%'
  root.style.height = '100%'
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
