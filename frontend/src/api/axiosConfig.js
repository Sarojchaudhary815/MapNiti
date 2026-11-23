import axios from 'axios';
import { API_ORIGIN } from '../config';

const API = axios.create({
    baseURL: `${API_ORIGIN}/api`, // ब्याकइन्डको ठेगाना (REACT_APP_API_URL)
});

// हरेक request मा localStorage बाट JWT token पढेर
// Authorization header मा स्वचालित रूपमा जोड्ने।
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;