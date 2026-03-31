import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

if (typeof window !== 'undefined') {
  // Expose the renderer's React copy so shared hooks can re-use it
  window.__SOUPZ_REACT__ = React
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
