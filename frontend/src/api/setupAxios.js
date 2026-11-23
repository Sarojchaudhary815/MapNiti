import axios from 'axios';

// WatershedDelineation.jsx जस्ता component ले raw `axios.post(...)`
// use गर्छन् (shared API instance होइन), tesमा पनि token auto-attach
// होस् भनेर global axios object मा पनि उहि interceptor थपिएको छ।
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});