import './App.css';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterEmployee from './pages/RegisterEmployee.jsx';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Projects from './pages/Projects';
import Report from './pages/Report';
import HrRecord from './pages/HrRecord';
import { useLocation } from 'react-router-dom';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import LeaveManagement from './pages/LeaveManagement';
import HrProjectAssignment from './hrRecords/HrProjectAssignment';
import Salary from './hrRecords/Salary';
import PaySlips from './pages/PaySlips';
import EmployeeReport from './pages/EmployeeReport';
import MobileBlock from './components/MobileBlock';
import ChatNotificationPopup from './components/ChatNotificationPopup';
import SplashScreen from './components/SplashScreen';
import { useAuth } from './context/AuthContext';
import { useState } from 'react';


function App() {
  const location = useLocation();
  const { bootLoading } = useAuth();
  // Brand splash on every full page load — except /login, whose page already plays the same animation
  const [showSplash] = useState(() => location.pathname !== '/login');

  return (
    <>
      {showSplash && <SplashScreen ready={!bootLoading} />}
      <ChatNotificationPopup />
      <div id="mobile-block" className="block md:hidden">
        <MobileBlock />
      </div>

      <div id="desktop-app" className="hidden md:flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col">
          {/* Hide Navbar on login, signup, and register-employee routes using useLocation */}
          {!["/login", "/signup", "/register-employee"].includes(location.pathname) && (
            <Navbar />
          )}

          <main className="flex-1 bg-gray-50">
            <Routes>
              <Route path="/register-employee" element={<RegisterEmployee />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Report /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
              <Route path='/hr' element={<ProtectedRoute><HrRecord/> </ProtectedRoute>} />
              <Route path='/hrproject' element={<ProtectedRoute><HrProjectAssignment/> </ProtectedRoute>} />
              <Route path='/profile' element={<ProtectedRoute><Profile/> </ProtectedRoute>} />
              <Route path='/timesheet' element={<ProtectedRoute><LeaveManagement/> </ProtectedRoute>} />
              <Route path='/payslip' element={<ProtectedRoute><PaySlips /> </ProtectedRoute>} />
              <Route path='/salary' element={<ProtectedRoute><Salary/> </ProtectedRoute>} />
              <Route path='/employees/:employeeId/report' element={<ProtectedRoute><EmployeeReport /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
