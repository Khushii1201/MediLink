import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import Spinner from './components/Spinner';

// Route-level lazy loading
const Home = lazy(() => import('./pages/Home'));
const Hospitals = lazy(() => import('./pages/Hospitals'));
const HospitalDetail = lazy(() => import('./pages/HospitalDetail'));
const Blood = lazy(() => import('./pages/Blood'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const HospitalDashboard = lazy(() => import('./pages/HospitalDashboard'));
const AmbulanceDashboard = lazy(() => import('./pages/AmbulanceDashboard'));
const BloodBankDashboard = lazy(() => import('./pages/BloodBankDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Suspense
              fallback={
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                  <Spinner size="lg" message="Loading MediLink..." />
                </div>
              }
            >
              <Routes>
                {/* Public Pages */}
                <Route path="/" element={<Home />} />
                <Route path="/hospitals" element={<Hospitals />} />
                <Route path="/hospitals/:id" element={<HospitalDetail />} />
                <Route path="/blood" element={<Blood />} />
                <Route path="/about" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Role-Protected Dashboards */}
                <Route
                  path="/patient"
                  element={
                    <ProtectedRoute roles={['PATIENT']}>
                      <PatientDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital"
                  element={
                    <ProtectedRoute roles={['HOSPITAL']}>
                      <HospitalDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ambulance"
                  element={
                    <ProtectedRoute roles={['AMBULANCE']}>
                      <AmbulanceDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bloodbank"
                  element={
                    <ProtectedRoute roles={['BLOODBANK']}>
                      <BloodBankDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={['ADMIN']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Catch-All */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
