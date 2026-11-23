import API from './axiosConfig';

export const listCollaborators = async (projectId) => {
    const response = await API.get(`/projects/${projectId}/collaborators`);
    return response.data; // { collaborators: [...], is_owner }
};

export const addCollaborator = async (projectId, email, role) => {
    const response = await API.post(`/projects/${projectId}/collaborators`, { email, role });
    return response.data;
};

export const removeCollaborator = async (projectId, collaboratorId) => {
    const response = await API.delete(`/projects/${projectId}/collaborators/${collaboratorId}`);
    return response.data;
};
