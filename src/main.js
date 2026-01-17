import './css/main.css';
import { createWorkspace } from './components/workspace-entry.js';

function bootstrap() {
  const root = document.querySelector('#app');

  if (!root) {
    throw new Error('Missing #app root element');
  }

  root.replaceChildren(createWorkspace());
}

document.addEventListener('DOMContentLoaded', bootstrap);
