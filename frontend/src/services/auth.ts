import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

// Rate limiting cache - track timestamps per endpoint
const rateLimitCache = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 5; // More conservative limit

const isRateLimited = (endpoint: string): boolean => {
  const now = Date.now();
  const key = `auth_${endpoint}`;
  const timestamps = rateLimitCache.get(key) || [];
  
  // Remove timestamps older than the window
  const recentTimestamps = timestamps.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }
  
  recentTimestamps.push(now);
  rateLimitCache.set(key, recentTimestamps);
  return false;
};

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    if (isRateLimited('login')) {
      throw new Error('Too many login attempts. Please wait a moment.');
    }
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    if (isRateLimited('register')) {
      throw new Error('Too many registration attempts. Please wait a moment.');
    }
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async getProfile(): Promise<User> {
    if (isRateLimited('profile')) {
      throw new Error('Too many profile requests. Please wait a moment.');
    }
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  setToken(token: string) {
    localStorage.setItem('token', token);
  },
};