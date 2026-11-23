import API from './axiosConfig';

export const listAllUsers = async () => {
    const response = await API.get('/admin/users');
    return response.data.users;
};

export const getAdminStats = async () => {
    const response = await API.get('/admin/stats');
    return response.data;
};
