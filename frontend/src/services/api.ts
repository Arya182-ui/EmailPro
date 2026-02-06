import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Rate limiting tracking
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 60; // Global rate limit

const isGloballyRateLimited = (): boolean => {
  const now = Date.now();
  const key = 'global_requests';
  const timestamps = requestTimestamps.get(key) || [];
  
  // Remove timestamps older than the window
  const recentTimestamps = timestamps.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }
  
  recentTimestamps.push(now);
  requestTimestamps.set(key, recentTimestamps);
  return false;
};

// Request interceptor to add auth token and rate limiting
api.interceptors.request.use(
  (config) => {
    // Check global rate limit
    if (isGloballyRateLimited()) {
      return Promise.reject(new Error('Rate limit exceeded. Please slow down.'));
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with rate limiting awareness
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 429) {
      // Rate limited by server - wait before retry
      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
      
      console.warn(`Rate limited by server. Waiting ${delay}ms before retry.`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (!originalRequest._retryCount) {
        originalRequest._retryCount = 0;
      }
      
      if (originalRequest._retryCount < 3) {
        originalRequest._retryCount++;
        return api(originalRequest);
      } else {
        toast.error('Too many requests. Please slow down and try again.');
      }
    }

    // Handle specific error messages without showing generic toast
    if (error.response?.status === 429) {
      // Already handled above
      return Promise.reject(error);
    } else if (error.response?.data?.error) {
      toast.error(error.response.data.error);
    } else if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      toast.error('Connection timeout. Please check your internet connection.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.message === 'Rate limit exceeded. Please slow down.') {
      toast.error('Rate limit exceeded. Please slow down.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
export { api };