import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/inter/wght.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/components.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/drawer.css';
import './styles/modals.css';
import './styles/forms.css';
import './styles/responsive.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
