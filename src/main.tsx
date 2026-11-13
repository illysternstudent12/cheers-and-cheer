import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/bar.css'
import './styles/venues.css'
import './styles/social.css'
import './styles/owner.css'
import './styles/controls.css'
import './styles/header.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
