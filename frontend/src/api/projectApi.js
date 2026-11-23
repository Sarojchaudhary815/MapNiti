import API from './axiosConfig';

export const createProject = async (name) => {
    const response = await API.post('/projects', { name });
    return response.data.project; // { id, name }
};

export const listProjects = async () => {
    const response = await API.get('/projects');
    return response.data.projects;
};

export const saveResult = async (projectId, module, toolType, inputGeometry, resultData) => {
    const response = await API.post(`/projects/${projectId}/results`, {
        module,
        tool_type: toolType,
        input_geometry: inputGeometry,
        result_data: resultData,
    });
    return response.data;
};

export const listResults = async (projectId) => {
    const response = await API.get(`/projects/${projectId}/results`);
    return response.data.results;
};

export const deleteProject = async (projectId) => {
    const response = await API.delete(`/projects/${projectId}`);
    return response.data;
};

export const getProjectsOverview = async () => {
    const response = await API.get('/projects/overview');
    return response.data.projects;
};