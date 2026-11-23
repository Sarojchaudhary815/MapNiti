import API from './axiosConfig';

export const analyzeLandUse = (area) => API.post('/urban/land-use', area);
export const getSuitability = (params) => API.post('/urban/suitability', params);
export const analyzeRoads = (data) => API.post('/urban/road-network', data);