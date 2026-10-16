import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/axios";
import { clearCache } from "../utils/pageCache";
import { useLocationTracker } from "../hooks/useLocationTracker";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  
  // Initialize location tracking for authenticated users
  const locationTracker = useLocationTracker(user);

  useEffect(() => {
    const load = async () => {
      // First try to authenticate with cookies (no localStorage check needed)
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
        
        // Check if user is currently checked in and start location tracking
        await checkAttendanceAndStartTracking(res.data._id);
        setBootLoading(false);
        return;
      } catch {
        // If cookie auth fails, try localStorage token
        const token = localStorage.getItem("token");
        if (token) {
          try {
            const res = await api.get("/auth/me");
            setUser(res.data);
            await checkAttendanceAndStartTracking(res.data._id);
          } catch {
            localStorage.removeItem("token");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setBootLoading(false);
    };
    load();
  }, []);

  // Check attendance status and start location tracking if checked in
  const checkAttendanceAndStartTracking = async (userId) => {
    try {
      // Server works out "today" in India time and includes a session still open past midnight
      const response = await api.get(`/attendance/status/${userId}`);
      
      if (response.data.hasCheckedIn && !response.data.hasCheckedOut) {
        // User is currently checked in, start location tracking
        locationTracker.startTracking();
      }
    } catch {
      // Don't fail if attendance check fails
    }
  };

  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, ...userData } = res.data;
      localStorage.setItem("token", token);
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || "Login failed" };
    }
  };


  const register = async (payload) => {
    try {
      const res = await api.post("/auth/register", payload);
      const { token, ...userData } = res.data;
      localStorage.setItem("token", token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || "Register failed" };
    }
  };

  const logout = async () => {
    try {
      // Tell the backend to clear the HTTP-only cookie
      await api.post("/auth/logout");
    } catch {
      // ignore network errors — still clear client state
    }
    localStorage.removeItem("token");
    clearCache(); // the next person to log in on this tab mustn't see this user's cached pages
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      bootLoading,
      locationTracker // Expose location tracking functionality
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
