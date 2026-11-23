import API from './axiosConfig';

export const getWatershed = (coords) => API.post('/hydrology/delineate', coords);
export const getFlowPath = (coords) => API.post('/hydrology/flow-path', coords);