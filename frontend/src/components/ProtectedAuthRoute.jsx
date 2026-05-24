import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedAuthRoute({ children }) {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1rem' }}>Loading...</div>;
  }

  // If user is logged in, redirect to /app
  if (isLoggedIn) {
    return <Navigate to="/app" replace />;
  }

  // If user is not logged in, allow access to login/signup
  return children;
}
