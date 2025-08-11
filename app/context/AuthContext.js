'use client'; // This directive is crucial for client components in App Router

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import axios from 'axios';
import { useRouter } from 'next/navigation'; // Use next/navigation for App Router

const AuthContext = createContext(null);

const API_BASE_URL = 'http://localhost:8000'; // Make sure this matches your backend

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // To check initial auth status
  const router = useRouter();

  useEffect(() => {
    // Check for token in localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('User re-authenticated from local storage:', parsedUser.username);
      } catch (e) {
        console.error('Failed to parse user from local storage:', e);
        // Clear invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false); // Authentication check is done
    const interceptor = axios.interceptors.response.use(
    (response) => response, // If response is successful, just return it
    (error) => {
      // Check if the error is an HTTP 401 (Unauthorized) or 403 (Forbidden)
      // And if the specific error message from your backend indicates a token issue
      if (error.response) {
          const { status, data } = error.response;
          if ((status === 401 || status === 403) && (data?.error === 'Invalid or expired token' || data?.error === 'Authentication token required')) {
              console.warn('Session expired or invalid token. Logging out automatically...');
              // Call the logout function using the ref
              logoutRef.current(); 
          }
      }
      return Promise.reject(error); // Re-throw the error for the specific component to handle
    }
  );

  // Cleanup function for useEffect
  // This removes the interceptor when the component unmounts to prevent memory leaks
  return () => {
    axios.interceptors.response.eject(interceptor);
  };
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { username, password });
      const { token: newToken, user: userData } = response.data;

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData)); // Store user data
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      console.log('Logged in successfully:', userData.username);
      router.push('/'); // Redirect to home page after login
      return { success: true, message: 'Login successful!' };
    } catch (error) {
      console.error('Login failed:', error.response?.data?.error || error.message);
      return { success: false, message: error.response?.data?.error || 'Login failed' };
    }
  };

  const logoutRef = useRef(() => {}); // Define the ref here

// Assign the actual logout logic to the ref's current property.
// This makes `logoutRef.current` contain your async logout function.
logoutRef.current = async () => { // <--- Start of the new logout definition
  try {
    // Optional: inform backend about logout, though for JWTs, client-side deletion is enough
    // await axios.post(`${API_BASE_URL}/logout`); // This will also send the token for validation
  } catch (error) {
    console.warn('Logout backend call failed (might be expired token, which is fine):', error.message);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization']; // Remove auth header
    console.log('Logged out.');
    router.push('/login'); // Redirect to login page after logout
  }
};

// This is the `logout` function that will be consumed by `useAuth()` hook
const logout = logoutRef.current;

  const authContextValue = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user, // Convenience boolean
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);