/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, AuthContextType, LoginResponse } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use VITE_API_BASE_URL to match api.ts configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );

  // Refresh authentication on mount
  useEffect(() => {
    if (accessToken) {
      refreshAuth();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Set up token refresh interval (14 minutes - before 15min expiry)
  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(() => {
      refreshAccessToken();
    }, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  /**
   * Login with username and password
   */
  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      setUser(data.user);
      setAccessToken(data.accessToken);
      localStorage.setItem('access_token', data.accessToken);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout and clear session
   */
  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint to revoke refresh token
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state regardless of API call result
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('access_token');
    }
  };

  /**
   * Refresh access token using refresh token
   */
  const refreshAccessToken = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send refresh token cookie
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      setAccessToken(data.accessToken);
      setUser(data.user);
      localStorage.setItem('access_token', data.accessToken);
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('access_token');
    }
  }, []); // No dependencies - logout inline to avoid circular dependency

  /**
   * Refresh authentication state (get current user)
   */
  const refreshAuth = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get user');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Refresh auth error:', error);
      // If getting user fails, try to refresh token
      await refreshAccessToken();
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Helper to get authorization header
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
