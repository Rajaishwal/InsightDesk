import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { UserCheck, LogOut, TimerIcon, Coffee, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Attendance from "../pages/Attendance.jsx";
import ChatPanel from "./ChatPanel.jsx";
import axios from "axios";
import api from "../services/axios.js";

const Navbar = ({ onOpenTimer }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
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
    } catch {}
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
    } catch {
      alert("Failed to start break. Please try again.");
    }
  };

  const handleBreakEnd = async () => {
    try {
      await axios.post("http://localhost:5000/api/breaks/stop", {
        userId: user._id,
      });
      setIsOnBreak(false);
    } catch {
      alert("Failed to end break. Please try again.");
    }
  };

  const breakOverLimit = breakElapsed > 5 * 60;

  return (
    <nav className="w-full bg-white shadow-md border-b border-gray-200 p-2 shadow-lg">
      <div className="max-w-8xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          {/* InsightDesk logo — square box, D with I through its center */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Square box, border-radius 3 */}
            <rect width="36" height="36" rx="3" fill="#1d4ed8"/>
            {/* D — white, stem + semicircle with hollow bowl (evenodd) */}
            <path
              fillRule="evenodd"
              fill="white"
              d="M4,4 L4,32 L10,32 A14,14 0 0,0 10,4 Z M10,9 A9,9 0 0,1 10,27 Z"
            />
            {/* I — yellow, bold serif, centered inside D bowl */}
            <rect x="11"  y="9"    width="7" height="2.5" rx="0.5" fill="#facc15"/>
            <rect x="13"  y="11.5" width="3" height="13"  rx="0.5" fill="#facc15"/>
            <rect x="11"  y="24.5" width="7" height="2.5" rx="0.5" fill="#facc15"/>
          </svg>
          <div className="text-[1.45rem] font-extrabold tracking-tight leading-none">
            <span className="text-blue-600">Insight</span><span className="text-yellow-400">Desk</span>
          </div>
        </div>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-4">

            {/* Attendance */}
            <div className="relative group">
              <button
                onClick={() => setShowAttendanceModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                  isCheckedIn
                    ? "bg-blue-50 text-blue-600 group-hover:bg-red-100 group-hover:text-red-700"
                    : "bg-blue-50 text-blue-600 group-hover:bg-green-100 group-hover:text-green-700"
                }`}
              >
                <UserCheck className="w-5 h-5" />
                <span className="hidden sm:inline">
                  {/* Default label — hidden on hover */}
                  <span className="block group-hover:hidden tabular-nums">
                    {isCheckedIn
                      ? formatAttendanceTime(attendanceElapsed)
                      : "Attendance"}
                  </span>
                  {/* Hover label — shown on hover */}
                  <span className="hidden group-hover:block font-semibold">
                    {isCheckedIn ? "Check Out" : "Check In"}
                  </span>
                </span>
              </button>
            </div>

            {/* Timer */}
            <button
              onClick={isCheckedIn ? onOpenTimer : undefined}
              disabled={!isCheckedIn}
              title={
                isCheckedOut
                  ? "Timer disabled after check-out"
                  : !isCheckedIn
                  ? "Check in first to use Timer"
                  : "Task Timer"
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                !isCheckedIn
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                  : "bg-green-50 text-green-600 hover:bg-green-100"
              }`}
            >
              <TimerIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Timer</span>
            </button>

            {/* Messages */}
            <button
              onClick={() => setShowChat(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 transition"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Messages</span>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 transition"
                >
                  <Coffee className="w-5 h-5" />
                  <span className="hidden sm:inline">Break</span>
                </button>
              ) : isOnBreak ? (
                <button
                  onClick={handleBreakEnd}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition animate-pulse ${
                    breakOverLimit
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  }`}
                >
                  <Coffee className="w-5 h-5" />
                  <span className="hidden sm:inline font-medium">
                    End Break {formatBreakTime(breakElapsed)}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleBreakStart}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition"
                >
                  <Coffee className="w-5 h-5" />
                  <span className="hidden sm:inline">Break</span>
                </button>
              )}
              {/* Break Tooltip — only when actively checked in */}
              {isCheckedIn && (
                <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block">
                  <div className="relative">
                    <div className="absolute -top-1 right-4 w-2 h-2 rotate-45 bg-white border-l border-t border-red-500" />
                    <div className="bg-white text-red-600 text-xs font-semibold border border-red-500 rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap">
                      {breakOverLimit
                        ? `Work extended  ${formatBreakTime(breakElapsed - 5 * 60)} min`
                        : isOnBreak
                        ? `${formatBreakTime(5 * 60 - breakElapsed)} min remaining`
                        : "Max break allowed: 5 min"}
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                  isCheckedIn
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                    : "bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {isCheckedIn && (
                <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block">
                  <div className="relative">
                    <div className="absolute -top-1 right-4 w-2 h-2 rotate-45 bg-white border-l border-t border-orange-400" />
                    <div className="bg-white text-orange-600 text-xs font-semibold border border-orange-400 rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap">
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