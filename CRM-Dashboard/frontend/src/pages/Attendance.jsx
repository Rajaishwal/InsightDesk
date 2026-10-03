import React, { useEffect, useState } from "react";
import { X, LogIn, LogOut } from "lucide-react";
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

// IST clock parts → { hour, minute, second, dayPeriod }
const istClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
});
const clockParts = (d) => Object.fromEntries(istClock.formatToParts(d).map(p => [p.type, p.value]));

const pad = (n) => String(n).padStart(2, "0");
const fmtDuration = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

// Glowing border palette per attendance state (project indigo/violet/blue, emerald, gray) — layers crossfade on state change
const CLOCK_STATES = {
  idle: {
    spin: "4s", digits: "text-indigo-600",
    chip: "border-indigo-300 text-indigo-600", dot: "bg-indigo-400",
    ring: "conic-gradient(from 0deg, transparent 0deg, #6366f1 70deg, #8b5cf6 115deg, transparent 150deg, transparent 180deg, #3b82f6 250deg, #6366f1 295deg, transparent 330deg)",
  },
  onDuty: {
    spin: "3s", digits: "text-emerald-600",
    chip: "border-emerald-400 text-emerald-600", dot: "bg-emerald-400",
    ring: "conic-gradient(from 0deg, transparent 0deg, #10b981 70deg, #34d399 115deg, transparent 150deg, transparent 180deg, #14b8a6 250deg, #10b981 295deg, transparent 330deg)",
  },
  done: {
    spin: "8s", digits: "text-gray-500",
    chip: "border-gray-300 text-gray-500", dot: "bg-gray-400",
    ring: "conic-gradient(from 0deg, transparent 0deg, #9ca3af 80deg, #d1d5db 120deg, transparent 160deg, transparent 360deg)",
  },
};

function Attendance({ onClose }) {
  const { user, locationTracker } = useAuth();
  const { startTracking, stopTracking } = locationTracker || {};
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
    const interval = setInterval(() => setDate(new Date()), 1000);
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
      window.dispatchEvent(new CustomEvent("crm:attendance:updated"));
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
      window.dispatchEvent(new CustomEvent("crm:attendance:updated"));
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

  /* ── Digital clock ── */
  const { hour, minute, second, dayPeriod } = clockParts(date);
  const { hasCheckedIn, hasCheckedOut, attendance } = attendanceStatus;
  const clockState = !hasCheckedIn ? "idle" : hasCheckedOut ? "done" : "onDuty";
  const cs = CLOCK_STATES[clockState];
  const statusText =
    clockState === "idle"   ? "Not checked in" :
    clockState === "onDuty" ? "On duty" : "Checked out";
  const statusValue =
    clockState === "onDuty" && attendance?.checkInTime ? fmtDuration(date - new Date(attendance.checkInTime)) :
    clockState === "done"   ? `${attendance?.workingHours ?? 0}h worked` : null;

  // One rotating conic layer per state; only the active one is visible, so state changes crossfade
  const ringLayers = Object.entries(CLOCK_STATES).map(([key, s]) => (
    <span
      key={key}
      aria-hidden="true"
      className={`absolute left-1/2 top-1/2 -ml-[200px] -mt-[200px] h-[400px] w-[400px] animate-spin motion-reduce:animate-none transition-opacity duration-700 ${key === clockState ? "opacity-100" : "opacity-0"}`}
      style={{ background: s.ring, animationDuration: s.spin }}
    />
  ));

  return (
    <div className="fixed bg-black/30 backdrop-blur-sm inset-0 z-[9999] flex items-center justify-center">
      <div className={`relative w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl animate-fadeIn transition-all duration-200 ${isAlertShowing ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
        {/* Brand strip — same as the dashboard profile header */}
        <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />

        <div className="p-7">
          {/* Header */}
          <div className="mb-5 flex items-center gap-3">
            {/* Avatar — photo, or initial fallback (same as dashboard profile header) */}
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-indigo-100">
              {user?.photo
                ? <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-lg font-black text-indigo-600">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </div>
              }
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-mono text-base font-bold tracking-wider text-gray-900">{user?.employeeId || "Attendance"}</h2>
              <p className="truncate text-[11px] text-gray-400">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Digital clock with glowing border */}
          <div className="relative">
            {/* Soft halo behind the border */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-0.5 overflow-hidden rounded-[14px] opacity-25 blur-sm">
              {ringLayers}
            </div>

            {/* Border ring */}
            <div className="relative overflow-hidden rounded-xl bg-gray-100 p-[2px]">
              {ringLayers}

              {/* Solid panel — the rotating light must only show through the 2px border gap */}
              <div className="relative rounded-[10px] bg-white px-5 pt-4 pb-3 text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Current time · IST</p>

                <div
                  className={`flex items-baseline justify-center gap-1 font-black tabular-nums leading-none transition-colors duration-700 ${cs.digits}`}
                  role="timer"
                  aria-label={`${hour}:${minute}:${second} ${dayPeriod}`}
                >
                  <span className="text-5xl">{hour}</span>
                  <span className="text-4xl animate-pulse motion-reduce:animate-none">:</span>
                  <span className="text-5xl">{minute}</span>
                  <span className="text-4xl animate-pulse motion-reduce:animate-none">:</span>
                  <span className="text-3xl opacity-70">{second}</span>
                  <span className="ml-1 text-[11px] font-bold uppercase tracking-widest opacity-60">{dayPeriod}</span>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 border-t border-gray-100 pt-3">
                  <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors duration-700 ${cs.chip}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${cs.dot} ${clockState === "onDuty" ? "animate-pulse" : ""}`} />
                    {statusText}
                  </span>
                  {statusValue && (
                    <span className="text-[11px] font-bold tabular-nums text-gray-500">{statusValue}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-gray-400">{formatDate(date)}</p>

          {/* Buttons — capsule outline style used across the dashboard */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleCheckIn}
              disabled={loading || hasCheckedIn}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Processing…" : "Check In"}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={loading || !hasCheckedIn || hasCheckedOut}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <LogOut className="h-4 w-4" />
              {loading ? "Processing…" : "Check Out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Attendance;
