import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import AmbulanceDashboard from './pages/AmbulanceDashboard';
import BloodBankDashboard from './pages/BloodBankDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/patient" element={<ProtectedRoute roles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/hospital" element={<ProtectedRoute roles={['HOSPITAL']}><HospitalDashboard /></ProtectedRoute>} />
          <Route path="/ambulance" element={<ProtectedRoute roles={['AMBULANCE']}><AmbulanceDashboard /></ProtectedRoute>} />
          <Route path="/bloodbank" element={<ProtectedRoute roles={['BLOODBANK']}><BloodBankDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </main>
    </>
  );
}
