import { Routes, Route } from 'react-router-dom';
import PM from './pages/PM';
import Admin from './pages/Admin';
import Finance from './pages/Finance';
import { AuthGate } from './lib/auth';

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<PM />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/finance" element={<Finance />} />
      </Routes>
    </AuthGate>
  );
}
