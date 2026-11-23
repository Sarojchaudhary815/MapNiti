import API from './axiosConfig';

export const loadDigitizedData = async (projectId) => {
    const response = await API.get(`/data/${projectId}/digitize`);
    return { layerGroups: response.data.layerGroups, featureCollection: response.data.featureCollection };
};

export const saveDigitizedData = async (projectId, layerGroups, featureCollection) => {
    const response = await API.put(`/data/${projectId}/digitize`, { layerGroups, featureCollection });
    return response.data;
};