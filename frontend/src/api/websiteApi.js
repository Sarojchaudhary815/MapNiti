import API from './axiosConfig';

export const sendContact = (data) => API.post('/website/contact', data);
export const applyJob = (data) => API.post('/website/apply', data);