import { useQuery, useMutation, useQueryClient } from 'react-query';
import { authService, type LoginRequest, type RegisterRequest } from '../services/auth';
import { handleApiError } from '../utils/errorHandling';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery(
    'user',
    authService.getProfile,
    {
      enabled: authService.isAuthenticated(),
      retry: (failureCount, error: any) => {
        // Don't retry on 401, 403, or 429 errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Only retry 5xx errors, max 2 attempts
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 30000),
      staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchInterval: false, // Disable automatic refetching
      onError: (error: any) => {
        if (error?.response?.status === 401) {
          authService.logout();
          queryClient.clear();
          window.location.href = '/login';
        } else if (error?.response?.status === 429) {
          // Don't show error for rate limiting, just log
          console.warn('Rate limit exceeded for auth endpoint');
        }
      },
    }
  );

  const loginMutation = useMutation(authService.login, {
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 429) {
        return failureCount < 2;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onSuccess: (data) => {
      authService.setToken(data.token);
      queryClient.setQueryData('user', data.user);
      toast.success('Login successful');
    },
    onError: (error: any) => {
      const message = handleApiError(error, 'login');
      if (error?.response?.status === 429) {
        toast.error('Too many login attempts. Please wait a moment and try again.');
      } else {
        toast.error(message);
      }
    },
  });

  const registerMutation = useMutation(authService.register, {
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 429) {
        return failureCount < 2;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onSuccess: (data) => {
      authService.setToken(data.token);
      queryClient.setQueryData('user', data.user);
      toast.success('Registration successful');
    },
    onError: (error: any) => {
      const message = handleApiError(error, 'register');
      if (error?.response?.status === 429) {
        toast.error('Too many registration attempts. Please wait a moment and try again.');
      } else {
        toast.error(message);
      }
    },
  });

  const logout = () => {
    authService.logout();
    queryClient.setQueryData('user', null);
    queryClient.clear();
    toast.success('Logged out successfully');
    // Use navigate instead of direct window.location to avoid hard refresh
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  };

  return {
    user,
    isLoading,
    isAuthenticated: authService.isAuthenticated(),
    login: (data: LoginRequest) => loginMutation.mutateAsync(data),
    register: (data: RegisterRequest) => registerMutation.mutateAsync(data),
    logout,
    isLoginLoading: loginMutation.isLoading,
    isRegisterLoading: registerMutation.isLoading,
  };
};