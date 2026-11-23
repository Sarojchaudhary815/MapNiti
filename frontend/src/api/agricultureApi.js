// agricultureApi.js
export const getNDVI = (area) => API.post('/agriculture/ndvi', area);

// disasterApi.js
export const getFloodRisk = (area) => API.post('/disaster/flood', area);