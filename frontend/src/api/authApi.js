import API from './axiosConfig';

export const sendOtp = async (email) => {
    const response = await API.post('/auth/send-otp', { email });
    return response.data;
};

export const verifyOtp = async (email, code) => {
    const response = await API.post('/auth/verify-otp', { email, code });
    return response.data;
};

export const registerUser = async (payload) => {
    const response = await API.post('/auth/register', {
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password,
        country: payload.country || null,
        occupation: payload.occupation || null,
        organization: payload.organization || null,
        role_title: payload.roleTitle || null,
    });
    saveSession(response.data);
    await hydrateProfile();
    return response.data;
};

export const loginUser = async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    saveSession(response.data);
    await hydrateProfile();
    return response.data;
};

export const loginWithGoogle = async (accessToken) => {
    const response = await API.post('/auth/google', { access_token: accessToken });
    saveSession(response.data);
    await hydrateProfile();
    return response.data;
};

const saveSession = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
};

// Login/register only return {id, full_name, email}. Fetch the full profile
// once right after so avatar/country/occupation/etc. are available locally
// without bloating the auth response itself.
const hydrateProfile = async () => {
    try {
        const full = await getMe();
        localStorage.setItem('user', JSON.stringify(full));
    } catch (err) {
        // Non-fatal — the basic {id, full_name, email} from saveSession still works.
        console.warn('Could not hydrate full profile:', err);
    }
};

export const getMe = async () => {
    const response = await API.get('/auth/me');
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await API.put('/auth/me', data);
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
};

export const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
};

export const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const getCurrentUser = () => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
};

export const isAuthenticated = () => {
    return !!localStorage.getItem('token');
};
