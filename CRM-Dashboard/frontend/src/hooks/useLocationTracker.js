// useLocationTracker.js — GPS tracking during a work session (started at check-in, stopped at check-out).
// Built to survive long sessions:
//  • refs instead of state inside timers, so the interval never works from stale values and stop really stops
//  • GPS is read every 5 min; the database is written when you move ≥100 m or every 30 min
//  • a timeout / weak signal (laptop sleep, idle tab) retries with a coarse read and keeps the last location
//  • network failures never flip the status; the server's "not checked in" is double-checked before stopping
//  • waking the tab / reconnecting re-reads the location straight away
import { useState, useEffect, useRef } from 'react';
import api from '../services/axios';

const LOCATION_THRESHOLD = 100;              // metres moved before an early database update
const UPDATE_INTERVAL = 30 * 60 * 1000;      // database update at least every 30 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;        // GPS read every 5 minutes
const GEO_PRECISE = { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 };
const GEO_COARSE = { enableHighAccuracy: false, timeout: 30000, maximumAge: 5 * 60 * 1000 };

// Distance between two points (Haversine), in metres
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Reverse geocoding via OpenStreetMap Nominatim
const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // stay under Nominatim's rate limit
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'CRM-Team-Location-Tracker' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.display_name) return null;
    return {
      address: data.display_name,
      city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '',
      state: data.address?.state || data.address?.region || '',
      country: data.address?.country || '',
    };
  } catch {
    return null;
  }
};

export const useLocationTracker = (user) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const userRef = useRef(user);
  const intervalRef = useRef(null);
  const trackingRef = useRef(false);
  const busyRef = useRef(false);        // one GPS read at a time
  const sentLocationRef = useRef(null); // last location saved to the server
  const sentAtRef = useRef(0);          // when it was saved

  useEffect(() => { userRef.current = user; });

  const stopTracking = () => {
    trackingRef.current = false;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsTracking(false);
  };

  // The server said "not checked in" — confirm before stopping (a long session can cross midnight)
  const stillCheckedIn = async () => {
    try {
      const r = await api.get(`/attendance/status/${userRef.current?._id}`);
      return !!r.data?.hasCheckedIn && !r.data?.hasCheckedOut;
    } catch {
      return true; // can't tell — keep tracking rather than wrongly showing Inactive
    }
  };

  const saveLocation = async (position, addressData, hasLocationChanged) => {
    try {
      await api.post('http://localhost:5000/api/location/update', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        hasLocationChanged,
        ...addressData,
      });
      sentLocationRef.current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      sentAtRef.current = Date.now();
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date(),
        accuracy: position.coords.accuracy,
        address: addressData?.address || null,
        city: addressData?.city || null,
        state: addressData?.state || null,
      });
      setLastUpdate(new Date());
      setLocationError(null);
    } catch (error) {
      if (error.response?.data?.requiresCheckIn) {
        if (await stillCheckedIn()) return; // transient mismatch — keep tracking, retry next tick
        setLocationError('Location tracking requires check-in. Please check in first.');
        stopTracking();
      } else if (!sentLocationRef.current) {
        // Only surface a network error if we have nothing to show yet; otherwise keep the last location
        setLocationError('Failed to update location in database');
      }
    }
  };

  const handlePosition = async (position) => {
    const { latitude, longitude } = position.coords;
    const prev = sentLocationRef.current;
    const moved = !prev || calculateDistance(prev.latitude, prev.longitude, latitude, longitude) >= LOCATION_THRESHOLD;
    const due = Date.now() - sentAtRef.current >= UPDATE_INTERVAL;
    if (!moved && !due) { setLocationError(null); return; } // nothing new to save — still active
    const addressData = await getAddressFromCoordinates(latitude, longitude);
    await saveLocation(position, addressData, moved);
  };

  const readPosition = () => {
    if (!trackingRef.current || busyRef.current || !navigator.geolocation) return;
    busyRef.current = true;
    const finish = async (position) => {
      try { if (position) await handlePosition(position); } finally { busyRef.current = false; }
    };
    navigator.geolocation.getCurrentPosition(
      finish,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied by user');
          stopTracking();
          busyRef.current = false;
          return;
        }
        // Timeout / position unavailable (sleep, indoors, weak signal): retry with a coarse read
        navigator.geolocation.getCurrentPosition(
          finish,
          () => {
            if (!sentLocationRef.current) {
              setLocationError(err.code === err.TIMEOUT ? 'Location request timed out' : 'Location information unavailable');
            }
            busyRef.current = false; // keep tracking; next tick tries again
          },
          GEO_COARSE
        );
      },
      GEO_PRECISE
    );
  };

  const startTracking = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          setLocationError('Location blocked by browser. Click the lock icon in the address bar → Site settings → Location → Allow, then reload the page.');
          return;
        }
      } catch {
        // Permissions API not fully supported — proceed anyway
      }
    }
    if (trackingRef.current) { readPosition(); return; } // already running — just refresh
    trackingRef.current = true;
    setIsTracking(true);
    setLocationError(null);
    readPosition();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(readPosition, CHECK_INTERVAL);
  };

  // Logged out → stop and forget everything
  useEffect(() => {
    if (user) return;
    stopTracking();
    sentLocationRef.current = null;
    sentAtRef.current = 0;
    setCurrentLocation(null);
    setLastUpdate(null);
    setLocationError(null);
  }, [user]);

  // Waking the tab / reconnecting → re-read immediately; check-in/out events start/stop tracking
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') readPosition(); };
    const onAttendance = (event) => {
      if (event.detail?.type === 'checkin') startTracking();
      else if (event.detail?.type === 'checkout') stopTracking();
      else readPosition();
    };
    const onStorage = (e) => { if (e.key === 'attendanceEvent') readPosition(); };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', readPosition);
    window.addEventListener('attendanceUpdate', onAttendance);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', readPosition);
      window.removeEventListener('attendanceUpdate', onAttendance);
      window.removeEventListener('storage', onStorage);
    };
  }); // re-bound each render: handlers only touch refs and state setters, so this is cheap and never stale

  // Unmount → clear the timer
  useEffect(() => () => clearInterval(intervalRef.current), []);

  return {
    currentLocation,
    locationError,
    isTracking,
    lastUpdate,
    startTracking,
    stopTracking,
  };
};
