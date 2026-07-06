import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  return <EmployeeDashboard />;
};

export default Dashboard;