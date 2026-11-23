/* eslint-disable testing-library/no-unnecessary-act -- plain React act(), not Testing Library */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, LanguageToggle, useT } from './index';

function Label() {
  const t = useT();
  return <p data-testid="label">{t('Live Nepal')} / {t('No such phrase')}</p>;
}

let host;
let root;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test('switches to Nepali, falls back to English, and remembers the choice', () => {
  act(() => root.render(<I18nProvider><LanguageToggle /><Label /></I18nProvider>));
  const label = () => host.querySelector('[data-testid=label]').textContent;
  expect(label()).toBe('Live Nepal / No such phrase');

  const [, ne] = host.querySelectorAll('button');
  act(() => ne.click());
  expect(label()).toBe('लाइभ नेपाल / No such phrase');
  expect(document.documentElement.lang).toBe('ne');
  expect(localStorage.getItem('mn_lang')).toBe('ne');
});
