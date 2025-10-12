import { TAGLINE, TITLE } from './constants.js';

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'workspace__header';

  const title = document.createElement('h1');
  title.className = 'workspace__title';
  title.textContent = TITLE;

  const tagline = document.createElement('p');
  tagline.className = 'workspace__tagline';
  tagline.textContent = TAGLINE;

  header.append(title, tagline);
  return header;
}

export function createHint() {
  const hint = document.createElement('p');
  hint.className = 'workspace__hint';
  hint.textContent =
    '初期バージョンではワークスペースの骨格を整え、操作フローを言語化しています。';
  return hint;
}
