/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlantProvider, usePlant } from './contexts/PlantContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PrintScreen from './pages/PrintScreen';
import SelectPlant from './pages/SelectPlant';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PlantRoute({ children }: { children: ReactNode }) {
  const { activePlant, loading } = usePlant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activePlant) {
    return <Navigate to="/select-plant" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <PlantProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/select-plant" 
              element={
                <ProtectedRoute>
                  <SelectPlant />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <PlantRoute>
                    <Dashboard />
                  </PlantRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/delivery-note/:id" 
              element={
                <ProtectedRoute>
                  <PlantRoute>
                    <PrintScreen />
                  </PlantRoute>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </PlantProvider>
    </AuthProvider>
  );
}
