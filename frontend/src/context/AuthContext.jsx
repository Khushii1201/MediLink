import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('medilink_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('medilink_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.getMe()
      .then((res) => {
        if (res.user) {
          localStorage.setItem('medilink_user', JSON.stringify(res.user));
          setUser(res.user);
        }
      })
      .catch(() => {
        localStorage.removeItem('medilink_token');
        localStorage.removeItem('medilink_user');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('medilink_token', token);
    localStorage.setItem('medilink_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('medilink_token');
    localStorage.removeItem('medilink_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
