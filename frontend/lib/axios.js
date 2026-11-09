import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If token expired → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    if (error.response?.data?.code === 'GOOGLE_CONNECTION_REQUIRED' && typeof window !== 'undefined') window.location.href = '/connect-google';
    if (error.response?.data?.code === 'SUBSCRIPTION_EXPIRED' && typeof window !== 'undefined' && !window.location.search.includes('subscription=expired')) window.location.href = '/dashboard?subscription=expired';
    return Promise.reject(error);
  }
);

export default api;
