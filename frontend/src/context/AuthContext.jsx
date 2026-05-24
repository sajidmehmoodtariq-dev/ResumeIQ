import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('rm_token');
    if (storedToken) {
      setToken(storedToken);
      // Optionally fetch user details from /api/auth/me to validate token
      validateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function validateToken(accessToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('rm_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Token validation error:', err);
      localStorage.removeItem('rm_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function login(accessToken, userData) {
    localStorage.setItem('rm_token', accessToken);
    setToken(accessToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('rm_token');
    setToken(null);
    setUser(null);
  }

  const isLoggedIn = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
