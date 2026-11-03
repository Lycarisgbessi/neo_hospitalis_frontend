import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp, UserRole } from './context/AppContext';
import SetupPage from './pages/SetupPage';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './layouts/DashboardLayout';
import GeneralDashboard from './pages/GeneralDashboard';
import ReceptionPage from './pages/ReceptionPage';
import CashierPage from './pages/CashierPage';
import DoctorPage from './pages/DoctorPage';
import PharmacyPage from './pages/PharmacyPage';
import LabPage from './pages/LabPage';
import SettingsPage from './pages/SettingsPage';
import FinancePage from './pages/FinancePage';
import NursePage from './pages/NursePage';
import ImageriePage from './pages/ImageriePage';
import GynecoPage from './pages/GynecoPage';
import PediatriePage from './pages/PediatriePage';
import { AIProvider } from './context/AIContext';
import { ToastProvider } from './components/Toast';

function ProtectedRoute({ children, reverse = false, allowedRoles }: { children: React.ReactNode, reverse?: boolean, allowedRoles?: UserRole[] }) {
  const { currentUser, isSetup } = useApp();
  
  if (!isSetup && reverse) return <SetupPage />;
  if (!isSetup) return <Navigate to="/setup" replace />;
  
  if (reverse) {
    if (currentUser) return <Navigate to="/" replace />;
  } else {
    if (!currentUser) return <Navigate to="/auth" replace />;
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
}

function MainApp() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/auth" element={<ProtectedRoute reverse><AuthPage /></ProtectedRoute>} />
      
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<GeneralDashboard />} />
        <Route path="reception" element={<ProtectedRoute allowedRoles={['receptionniste', 'super_admin']}><ReceptionPage /></ProtectedRoute>} />
        <Route path="doctor" element={<ProtectedRoute allowedRoles={['medecin', 'super_admin']}><DoctorPage /></ProtectedRoute>} />
        <Route path="gyneco" element={<ProtectedRoute allowedRoles={['medecin', 'sage_femme', 'super_admin']}><GynecoPage /></ProtectedRoute>} />
        <Route path="pediatrie" element={<ProtectedRoute allowedRoles={['medecin', 'super_admin']}><PediatriePage /></ProtectedRoute>} />
        <Route path="caisse" element={<ProtectedRoute allowedRoles={['caissier', 'comptable', 'super_admin']}><CashierPage /></ProtectedRoute>} />
        <Route path="pharmacie" element={<ProtectedRoute allowedRoles={['pharmacien', 'super_admin']}><PharmacyPage /></ProtectedRoute>} />
        <Route path="labo" element={<ProtectedRoute allowedRoles={['technicien_labo', 'super_admin']}><LabPage /></ProtectedRoute>} />
        <Route path="imagerie" element={<ProtectedRoute allowedRoles={['technicien_imagerie', 'super_admin']}><ImageriePage /></ProtectedRoute>} />
        <Route path="finance" element={<ProtectedRoute allowedRoles={['directeur_financier', 'comptable', 'super_admin']}><FinancePage /></ProtectedRoute>} />
        <Route path="infirmier" element={<ProtectedRoute allowedRoles={['infirmier', 'super_admin']}><NursePage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<div className="p-8">En cours de développement...</div>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ToastProvider>
          <AIProvider>
            <MainApp />
          </AIProvider>
        </ToastProvider>
      </BrowserRouter>
    </AppProvider>
  );
}
