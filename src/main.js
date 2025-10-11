import './style.css';
import { createWorkspace } from './workspace.js';

function bootstrap() {
  const root = document.querySelector('#app');

  if (!root) {
    throw new Error('Missing #app root element');
  }

  root.replaceChildren(createWorkspace());
}

document.addEventListener('DOMContentLoaded', bootstrap);
