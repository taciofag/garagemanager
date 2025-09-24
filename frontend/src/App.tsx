import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Rentals from './pages/Rentals';
import Expenses from './pages/Expenses';
import Vendors from './pages/Vendors';
import RentPayments from './pages/RentPayments';
import Capital from './pages/Capital';
import Cash from './pages/Cash';
import Summary from './pages/Summary';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="rentals" element={<Rentals />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="rent-payments" element={<RentPayments />} />
        <Route path="capital" element={<Capital />} />
        <Route path="cash" element={<Cash />} />
        <Route path="summary" element={<Summary />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
