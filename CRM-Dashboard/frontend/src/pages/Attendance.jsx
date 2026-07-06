import React, { useEffect, useState } from "react";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  timer: 3000,
  timerProgressBar: true,
  background: "#333",
  color: "#fff",
  customClass: { popup: "long-toast" },
  didOpen: () => {
    const el = document.querySelector('.swal2-container');
    if (el) el.style.zIndex = '100000';
  }
});

function Attendance({ onClose }) {
  const { user, locationTracker } = useAuth();
  const { startTracking, stopTracking } = locationTracker || {};
  const [currentTime, setCurrentTime] = useState("");
  const [date, setDate] = useState(new Date());
  const [attendanceStatus, setAttendanceStatus] = useState({
    hasCheckedIn: false,
    hasCheckedOut: false,
    attendance: null
  });
  const [loading, setLoading] = useState(false);
  const [isAlertShowing, setIsAlertShowing] = useState(false);

  const showAlert = (opts) => {
    setIsAlertShowing(true);
    return Swal.fire({
      ...opts,
      didOpen: () => {
        const el = document.querySelector('.swal2-container');
        if (el) el.style.zIndex = '100000';
      },
      didClose: () => setIsAlertShowing(false),
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setDate(now);
      setCurrentTime(
        now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?._id) {
      fetchTodayStatus();
    }
  }, [user]);

  const fetchTodayStatus = async () => {
    try {
      const response = await api.get(`http://localhost:5000/api/attendance/status/${user._id}`);
      setAttendanceStatus(response.data);
    } catch (error) {
      console.error("Error fetching attendance status:", error);
    }
  };

  const handleCheckIn = async () => {
    if (attendanceStatus.hasCheckedIn) {
      Toast.fire({ icon: "warning", title: "You have already checked in today." });
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("http://localhost:5000/api/attendance/checkin", { userId: user._id });

      if (response.data.locationTrackingActivated) {
        startTracking();
      }

      window.dispatchEvent(new CustomEvent("attendanceUpdate", {
        detail: { type: "checkin", userId: user._id }
      }));
      localStorage.setItem("attendanceEvent", Date.now().toString());
      fetchTodayStatus();

      showAlert({
        icon: "success",
        title: "Check-in Successfully!",
        text: response.data.locationTrackingActivated ? "Location tracking started." : undefined,
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (error) {
      Toast.fire({
        icon: "error",
        title: error.response?.data?.message || "Check-In Failed. Try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!attendanceStatus.hasCheckedIn) {
      Toast.fire({ icon: "error", title: "You must check in before checking out." });
      return;
    }
    if (attendanceStatus.hasCheckedOut) {
      Toast.fire({ icon: "warning", title: "You have already checked out today." });
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("http://localhost:5000/api/attendance/checkout", { userId: user._id });

      if (response.data.locationTrackingDeactivated) {
        stopTracking();
      }
      showAlert({
        icon: "success",
        title: "Check-out Successfully!",
        text: `Working Hours: ${response.data.workingHours}h${response.data.locationTrackingDeactivated ? "\nLocation tracking stopped." : ""}`,
        showConfirmButton: false,
        timer: 2000,
      });

      window.dispatchEvent(new CustomEvent("attendanceUpdate", { 
        detail: { type: "checkout", userId: user._id } 
      }));
      localStorage.setItem("attendanceEvent", Date.now().toString());

      fetchTodayStatus();
    } catch (error) {
      Toast.fire({
        icon: "error",
        title: error.response?.data?.message || "Check-Out Failed. Try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div className="fixed bg-black/30 backdrop-blur-sm inset-0 z-[9999] flex items-center justify-center">
      <div className={`relative w-[380px] bg-white p-8 text-center shadow-xl animate-fadeIn transition-all duration-200 ${isAlertShowing ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-2 text-xl text-gray-500 transition cursor-pointer hover:text-red-500"
        >
          ✖
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Attendance System</h2>
          <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
        </div>

        {/* Time */}
        <div className="mb-6">
          <div className="mb-1 text-base">
            <strong>Current Time: </strong>
            <span className="font-bold text-blue-600">{currentTime}</span>
          </div>
          <div className="text-sm text-gray-600">{formatDate(new Date())}</div>
        </div>

        {/* Clock */}
        <div className="relative mb-6 inline-block">
          <Clock value={date} size={200} />
          <div className="absolute inset-0 flex items-center justify-center text-gray-700 font-bold">
            {/* Clock Numbers */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2">12</div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2">3</div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">6</div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2">9</div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={handleCheckIn}
            disabled={loading || attendanceStatus.hasCheckedIn}
            className={`rounded-lg px-5 py-2 font-semibold text-white transition 
              ${attendanceStatus.hasCheckedIn || loading 
                ? "cursor-not-allowed bg-green-500 opacity-60" 
                : "bg-green-500 hover:bg-green-600"}`}
          >
            {loading ? "Processing..." : "Check In"}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={loading || !attendanceStatus.hasCheckedIn || attendanceStatus.hasCheckedOut}
            className={`rounded-lg px-5 py-2 font-semibold text-white transition 
              ${!attendanceStatus.hasCheckedIn || attendanceStatus.hasCheckedOut || loading
                ? "cursor-not-allowed bg-red-500 opacity-60" 
                : "bg-red-500 hover:bg-red-600"}`}
          >
            {loading ? "Processing..." : "Check Out"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Attendance;
