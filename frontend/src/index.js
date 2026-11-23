import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // .jsx lekhnu pardaina, App matra lekhe huncha
import { I18nProvider } from './i18n';
import './index.css';
import './api/setupAxios';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);