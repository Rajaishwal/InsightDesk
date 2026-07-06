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
import StaffWorkload from './pages/StaffWorkload';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import LeaveManagement from './pages/LeaveManagement';
import HrProject from './hrRecords/HrProject';
import Salary from './hrRecords/Salary';
import PaySlips from './pages/PaySlips';


function App() {
  const [tasks, setTasks] = useState([]);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const location = useLocation();

  // Called when saving a task from the timer modal
  const handleSaveTask = (taskTitle, desc, time) => {
    const newTask = {
      title: taskTitle,
      description: desc,
      timeTaken: time,
    };
    setTasks(prev => [...prev, newTask]);
  };

  return (
    <>
      <div id="mobile-block" className='block md:hidden text-center text-red-600 text-xl p-6'>
        This CRM application is not available on mobile devices.
      </div>

      <div id="desktop-app" className="hidden md:flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col">
          {/* Hide Navbar on login, signup, and register-employee routes using useLocation */}
          {!["/login", "/signup", "/register-employee"].includes(location.pathname) && (
            <Navbar
              onOpenTimer={() => {
                setShowTimerModal(true);
                window.dispatchEvent(new CustomEvent("openTaskTimer"));
              }}
            />
          )}

          <main className="flex-1 bg-gray-50">
            <Routes>
              <Route path="/register-employee" element={<RegisterEmployee />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<ProtectedRoute><Dashboard 
                tasks={tasks}
                handleSaveTask={handleSaveTask}
                showTimerModal={showTimerModal}
                onOpenTimer={() => setShowTimerModal(true)}
                onCloseTimer={() => setShowTimerModal(false)}
              /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Report /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
              <Route path='/hr' element={<ProtectedRoute><HrRecord/> </ProtectedRoute>} />
              <Route path='/hrproject' element={<ProtectedRoute><HrProject/> </ProtectedRoute>} />
              <Route path='/profile' element={<ProtectedRoute><Profile/> </ProtectedRoute>} />
              <Route path='/timesheet' element={<ProtectedRoute><LeaveManagement/> </ProtectedRoute>} />
              <Route path='/workload' element={<ProtectedRoute><StaffWorkload/> </ProtectedRoute>} />
              <Route path='/payslip' element={<ProtectedRoute><PaySlips /> </ProtectedRoute>} />
              <Route path='/salary' element={<ProtectedRoute><Salary/> </ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
