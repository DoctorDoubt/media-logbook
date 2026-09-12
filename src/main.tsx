import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { migrateStorageKeys } from './config'
import './index.css'

// Before anything reads storage, so a renamed prefix keeps existing data.
migrateStorageKeys()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
