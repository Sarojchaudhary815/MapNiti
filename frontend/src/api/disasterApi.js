import API from './axiosConfig';

/**
 * Disaster Risk Analysis API calls
 */

// १. बाढी जोखिम विश्लेषण (Flood Risk Analysis)
export const analyzeFloodRisk = async (areaData) => {
    return await API.post('/disaster/flood-risk', areaData);
};

// २. पहिरो संवेदनशीलता नक्सा (Landslide Susceptibility)
export const getLandslideMap = async (params) => {
    return await API.get('/disaster/landslide-map', { params });
};

// ३. विपद् क्षति मूल्याङ्कन (Damage Assessment)
export const getDamageAssessment = async (incidentId) => {
    return await API.get(`/disaster/damage/${incidentId}`);
};

export default {
    analyzeFloodRisk,
    getLandslideMap,
    getDamageAssessment
};