import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  // StrictMode desactivado em produção para evitar double-mount
  // dos WebSockets (causava sessões duplicadas no backend).
  // Em desenvolvimento, usar <StrictMode> só se precisares de
  // detectar efeitos colaterais — sabendo que os WS vão ligar 2x.
  <App />
)
