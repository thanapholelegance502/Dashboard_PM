import { Routes, Route } from 'react-router-dom';
import PM from './pages/PM';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import Finance from './pages/Finance';
import Yok from './pages/Yok';
import { AuthGate } from './lib/auth';

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pm" element={<PM />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/yok" element={<Yok />} />
      </Routes>
    </AuthGate>
  );
}
