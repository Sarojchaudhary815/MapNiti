// Offline queue for field records, kept in IndexedDB so points (and their
// photos) survive closing the tab or losing signal until they are synced.
const DB = 'mapniti-field';
const STORE = 'pending';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'client_id' });
      s.createIndex('survey_id', 'survey_id');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result ?? out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const newClientId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '');

export const queueRecord = (rec) => tx('readwrite', (s) => s.put(rec));
export const removeQueued = (ids) => tx('readwrite', (s) => ids.forEach((id) => s.delete(id)));
export const pendingFor = (surveyId) => tx('readonly', (s) => s.index('survey_id').getAll(surveyId));
export const pendingCount = () => tx('readonly', (s) => s.count());

// Shrink a camera photo to at most `max` px and JPEG-encode it, so a phone
// photo (often 4–8 MB) becomes a few hundred KB before it is queued.
export function compressPhoto(file, max = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
    img.src = url;
  });
}
