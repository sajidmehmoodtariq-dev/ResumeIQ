import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/Home.jsx';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
