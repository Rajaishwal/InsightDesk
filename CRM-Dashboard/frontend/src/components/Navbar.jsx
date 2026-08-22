// Navbar.jsx — Top navigation bar: attendance check-in/out, break timer, messages, logout
import { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { UserCheck, LogOut, Coffee, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Attendance from "../pages/Attendance.jsx";
import ChatPanel from "./ChatPanel.jsx";
import axios from "axios";
import api from "../services/axios.js";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const toast = useToast();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // --- Attendance live timer ---
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [attendanceElapsed, setAttendanceElapsed] = useState(0);
  const attendanceTimerRef = useRef(null);

  // --- Break live timer ---
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const breakTimerRef = useRef(null);

  const navigate = useNavigate();

  // Fetch today's attendance status
  const fetchAttendanceStatus = async () => {
    if (!user?._id) return;
    try {
      const res = await api.get(`/attendance/status/${user._id}`);
      setAttendanceStatus(res.data);
    } catch { }
  };

  useEffect(() => {
    fetchAttendanceStatus();
    const handler = () => fetchAttendanceStatus();
    window.addEventListener("attendanceUpdate", handler);
    return () => window.removeEventListener("attendanceUpdate", handler);
  }, [user]);

  // Start/stop attendance timer based on check-in status
  useEffect(() => {
    const isActive =
      attendanceStatus?.hasCheckedIn && !attendanceStatus?.hasCheckedOut;

    if (isActive && attendanceStatus?.attendance?.checkInTime) {
      const checkInTime = new Date(attendanceStatus.attendance.checkInTime);
      setAttendanceElapsed(
        Math.floor((Date.now() - checkInTime.getTime()) / 1000)
      );
      attendanceTimerRef.current = setInterval(() => {
        setAttendanceElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(attendanceTimerRef.current);
      setAttendanceElapsed(0);
    }
    return () => clearInterval(attendanceTimerRef.current);
  }, [attendanceStatus]);

  const formatAttendanceTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const isCheckedIn =
    attendanceStatus?.hasCheckedIn && !attendanceStatus?.hasCheckedOut;
  const isCheckedOut = !!attendanceStatus?.hasCheckedOut;

  // --- Break logic ---
  const getTodayCompletedSeconds = async (userId) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/breaks/logs/${userId}`
      );
      const today = new Date().toISOString().slice(0, 10);
      return res.data
        .filter(
          (b) =>
            b.endTime &&
            new Date(b.startTime).toISOString().slice(0, 10) === today
        )
        .reduce((sum, b) => sum + (b.durationInSeconds || 0), 0);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    if (!user?._id) return;
    (async () => {
      const [statusRes, completedSecs] = await Promise.all([
        axios
          .get(`http://localhost:5000/api/breaks/status/${user._id}`)
          .catch(() => null),
        getTodayCompletedSeconds(user._id),
      ]);
      if (statusRes?.data?.isOnBreak) {
        setIsOnBreak(true);
        setBreakElapsed(completedSecs + (statusRes.data.elapsedSeconds || 0));
      } else {
        setBreakElapsed(completedSecs);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (isOnBreak) {
      breakTimerRef.current = setInterval(() => {
        setBreakElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(breakTimerRef.current);
    }
    return () => clearInterval(breakTimerRef.current);
  }, [isOnBreak]);

  const formatBreakTime = (seconds) => {
    if (!seconds || seconds <= 0) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleBreakStart = async () => {
    try {
      await axios.post("http://localhost:5000/api/breaks/start", {
        userId: user._id,
      });
      setIsOnBreak(true);
      window.dispatchEvent(new CustomEvent("crm:attendance:updated"));
    } catch {
      toast.error("Failed to start break. Please try again.");
    }
  };

  const handleBreakEnd = async () => {
    try {
      await axios.post("http://localhost:5000/api/breaks/stop", {
        userId: user._id,
      });
      setIsOnBreak(false);
      window.dispatchEvent(new CustomEvent("crm:attendance:updated"));
    } catch {
      toast.error("Failed to end break. Please try again.");
    }
  };

  const breakOverLimit = breakElapsed > 60 * 60;

  return (
    <nav className="w-full p-2">
      <div className="max-w-8xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center">
          {/*
            InsightDesk mark — "ID" monogram
            Blue [  = bracket (the I)
            Gold D  = two quarter-arcs through midpoint (avoids degenerate chord=diameter arc)
          */}
          <img src={logo} alt="InsightDesk logo" className="h-12" />

          {/* Wordmark + tagline */}
          <div className="flex flex-col leading-none">
            <div className="text-[1.4rem] font-extrabold tracking-tight">
              <span className="text-blue-600">Insight</span><span className="text-amber-400">Desk</span>
            </div>
            <span className="text-[0.56rem] font-semibold tracking-[0.18em] text-gray-400 uppercase mt-2">
              Track Your Performance
            </span>
          </div>
        </div>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-2">

            {/* Attendance */}
            <div className="relative group">
              <button
                onClick={() => setShowAttendanceModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${isCheckedIn
                  ? "bg-indigo-50 text-indigo-500 border-indigo-200 group-hover:bg-red-50 group-hover:text-red-500 group-hover:border-red-200"
                  : "bg-indigo-50 text-indigo-500 border-indigo-200 group-hover:bg-green-50 group-hover:text-green-600 group-hover:border-green-200"
                  }`}
              >
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">
                  <span className="block group-hover:hidden tabular-nums">
                    {isCheckedIn ? formatAttendanceTime(attendanceElapsed) : "Attendance"}
                  </span>
                  <span className="hidden group-hover:block">
                    {isCheckedIn ? "Check Out" : "Check In"}
                  </span>
                </span>
              </button>
            </div>

            {/* Messages */}
            <button
              onClick={() => setShowChat(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-purple-200 bg-purple-50 text-purple-500 hover:bg-purple-100 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Break */}
            <div className="relative group">
              {!isCheckedIn ? (
                <button
                  disabled
                  title={isCheckedOut ? "Break disabled after check-out" : "Check in first to use Break"}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span className="hidden sm:inline">Break</span>
                </button>
              ) : isOnBreak ? (
                <button
                  onClick={handleBreakEnd}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all animate-pulse ${breakOverLimit
                    ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                    : "bg-orange-50 text-orange-500 border-orange-200 hover:bg-orange-100"
                    }`}
                >
                  <Coffee className="w-4 h-4" />
                  <span className="hidden sm:inline">End {formatBreakTime(breakElapsed)}</span>
                </button>
              ) : (
                <button
                  onClick={handleBreakStart}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-100 transition-all"
                >
                  <Coffee className="w-4 h-4" />
                  <span className="hidden sm:inline">Break</span>
                </button>
              )}
              {/* Break tooltip */}
              {isCheckedIn && (
                <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block">
                  <div className="relative">
                    <div className="absolute -top-1 right-4 w-2 h-2 rotate-45 bg-white border-l border-t border-gray-200" />
                    <div className="bg-white text-gray-600 text-xs font-semibold border border-gray-200 rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap">
                      {breakOverLimit
                        ? `Overtime: ${formatBreakTime(breakElapsed - 60 * 60)}`
                        : isOnBreak
                          ? `${formatBreakTime(60 * 60 - breakElapsed)} remaining`
                          : "Max break: 60 min"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <div className="relative group">
              <button
                onClick={isCheckedIn ? undefined : logout}
                disabled={isCheckedIn}
                title={isCheckedIn ? "Please check out before logging out" : "Logout"}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${isCheckedIn
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                  }`}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {isCheckedIn && (
                <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block">
                  <div className="relative">
                    <div className="absolute -top-1 right-4 w-2 h-2 rotate-45 bg-white border-l border-t border-gray-200" />
                    <div className="bg-white text-gray-600 text-xs font-semibold border border-gray-200 rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap">
                      Check out first before logging out
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/register-employee")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
            >
              <span className="hidden sm:inline">Register Employee</span>
            </button>
            <span className="text-sm text-gray-500 italic">
              You are not signed in
            </span>
          </div>
        )}
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <Attendance onClose={() => setShowAttendanceModal(false)} />
      )}

      {/* Chat Panel */}
      {showChat && <ChatPanel onClose={() => setShowChat(false)} />}
    </nav>
  );
};

export default Navbar;