// Backend origin. Set REACT_APP_API_URL at build time for hosting, e.g.
//   REACT_APP_API_URL=https://api.your-domain.com npm run build
// Set it to an empty string when nginx proxies /api on the same domain.
export const API_ORIGIN = process.env.REACT_APP_API_URL ?? 'http://127.0.0.1:8000';
export const API_BASE_URL = API_ORIGIN;
