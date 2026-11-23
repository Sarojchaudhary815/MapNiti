import API from './axiosConfig';
import { API_ORIGIN } from '../config';

// ---- GEE Data Hub ----
export const getGeeCatalog = async () => (await API.get('/gee/catalog')).data.datasets;
export const fetchGeeLayer = async (payload) => (await API.post('/gee/layer', payload)).data;
export const fetchGeeTimeseries = async (payload) => (await API.post('/gee/timeseries', payload)).data;
export const fetchGeeCustom = async (payload) => (await API.post('/gee/custom', payload)).data;

// ---- Engineer Toolkit ----
export const fetchSiteReport = async (geometry) => (await API.post('/engineering/site-report', { geometry })).data;
export const fetchPointInfo = async (lat, lng) => (await API.post('/engineering/point', { lat, lng })).data;
export const fetchProfile = async (points, demSource = 'SRTM', samples = 150) =>
  (await API.post('/engineering/profile', { points, dem_source: demSource, samples })).data;

// ---- Learning progress ----
export const getLearnProgress = async () => (await API.get('/learn/progress')).data.progress;
export const setLessonProgress = async (courseId, lessonId, completed = true) =>
  (await API.post('/learn/progress', { course_id: courseId, lesson_id: lessonId, completed })).data;

// ---- AI assistant (streams plain text) ----
export const getAiStatus = async () => (await API.get('/ai/status')).data;

export async function streamAiChat(messages, context, onChunk, signal) {
  const res = await fetch(`${API_ORIGIN}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

// ---- Analysis tools (urban / disaster / agriculture / hydrology) ----
export const runAnalysis = async (toolId, payload) => (await API.post(`/analysis/${toolId}`, payload)).data;

// ---- Data download centre ----
export const downloadRasters = async (payload) => (await API.post('/downloads/rasters', payload)).data;
export const downloadContours = async (payload) => (await API.post('/downloads/contours', payload)).data;
export const downloadOsm = async (payload) => (await API.post('/downloads/osm', payload)).data;
export const downloadGeeVector = async (payload) => (await API.post('/downloads/gee-vector', payload)).data;
export const getBoundaries = async (country = 'NPL') => (await API.get(`/downloads/boundaries/${country}`)).data;
export const getBoundaryGeojson = async (level, country = 'NPL') =>
  (await API.get(`/downloads/boundaries/${country}/${level}`, { timeout: 180000 })).data;

// ---- Community articles (published analyses) ----
export const publishArticle = async (payload) => (await API.post('/articles', payload)).data;
export const listArticles = async (limit = 30) => (await API.get('/articles', { params: { limit } })).data;
export const getArticle = async (slug) => (await API.get(`/articles/${slug}`)).data;
export const myArticles = async () => (await API.get('/articles/mine')).data;
export const deleteArticle = async (slug) => (await API.delete(`/articles/${slug}`)).data;
