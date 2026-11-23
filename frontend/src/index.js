import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // .jsx lekhnu pardaina, App matra lekhe huncha
import './index.css';
import './api/setupAxios';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);