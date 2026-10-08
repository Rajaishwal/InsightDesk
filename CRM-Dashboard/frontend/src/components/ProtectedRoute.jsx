import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, bootLoading } = useAuth();
  // Wait for the session check on a fresh load/refresh — otherwise a logged-in user bounces to /login, then to "/"
  if (bootLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;