// Syntax highlighting shared by the Code Lab editor and lesson / AI code blocks.
// Prism core already includes markup (HTML), CSS, clike and JavaScript.
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import './codeTheme.css';

const ALIAS = {
  py: 'python', python: 'python', pyqgis: 'python', 'python-desktop': 'python',
  js: 'javascript', javascript: 'javascript', gee: 'javascript', jsx: 'javascript',
  html: 'markup', htm: 'markup', xml: 'markup', markup: 'markup', svg: 'markup',
  css: 'css', sql: 'sql', json: 'json', geojson: 'json',
  bash: 'bash', sh: 'bash', shell: 'bash', powershell: 'bash',
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Returns safe HTML for `code` with Prism token spans (escaped plain text if the language is unknown). */
export function highlight(code, lang) {
  const id = ALIAS[(lang || '').toLowerCase()];
  const grammar = id && Prism.languages[id];
  return grammar ? Prism.highlight(code, grammar, id) : escapeHtml(code);
}
