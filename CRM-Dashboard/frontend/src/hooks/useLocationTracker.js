import { useState, useEffect } from 'react';
import api from '../services/axios';

export const useLocationTracker = (user) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Minimum distance threshold for location updates (in meters)
  const LOCATION_THRESHOLD = 100;
  
  // Time interval for periodic updates (30 minutes in milliseconds)
  const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes
  
  // Reference to tracking interval
  const [trackingInterval, setTrackingInterval] = useState(null);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  };

  // Get address from coordinates (reverse geocoding)
  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      console.log('🌍 Attempting to get address for coordinates:', { latitude, longitude });
      
      // Using OpenStreetMap Nominatim API (free alternative to Google Maps)
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CRM-Team-Location-Tracker' // Required by Nominatim
          }
        }
      );
      
      if (!response.ok) {
        console.warn('🚫 Nominatim API response not ok:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json();
      console.log('📍 Raw address data from Nominatim:', data);
      
      if (data && data.display_name) {
        const addressInfo = {
          address: data.display_name,
          city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '',
          state: data.address?.state || data.address?.region || '',
          country: data.address?.country || ''
        };
        
        console.log('✅ Parsed address info:', addressInfo);
        return addressInfo;
      } else {
        console.warn('⚠️ No address data found in response');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting address from coordinates:', error);
      return null;
    }
  };

  // Send location update to backend
  const updateLocationInDatabase = async (position, addressData = null, hasLocationChanged = false) => {
    try {
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        hasLocationChanged, // Indicate if this is a new location or time-based update
        ...addressData
      };

      console.log('📤 Sending location data to backend:', locationData);
      
      const response = await api.post('http://localhost:5000/api/location/update', locationData);
      console.log('✅ Location update response:', response.data);
      
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
      
    } catch (error) {
      // Handle specific case when user is not checked in
      if (error.response?.data?.requiresCheckIn) {
        console.log('Location tracking requires check-in. Stopping tracking.');
        setLocationError('Location tracking requires check-in. Please check in first.');
        stopTracking(); // Stop tracking if not checked in
      } else {
        console.error('❌ Error updating location:', error);
        setLocationError('Failed to update location in database');
      }
    }
  };

  // Handle successful geolocation
  const handleLocationSuccess = async (position) => {
    const newLat = position.coords.latitude;
    const newLon = position.coords.longitude;
    const now = Date.now();
    
    console.log('📍 New location received:', { 
      latitude: newLat, 
      longitude: newLon, 
      accuracy: position.coords.accuracy 
    });
    
    // Check if enough time has passed for a periodic update (30 minutes)
    const timeSinceLastUpdate = lastUpdate ? now - lastUpdate.getTime() : UPDATE_INTERVAL;
    const shouldUpdateByTime = timeSinceLastUpdate >= UPDATE_INTERVAL;
    
    // Check if location has changed significantly
    let hasLocationChanged = false;
    if (currentLocation) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        newLat,
        newLon
      );
      hasLocationChanged = distance >= LOCATION_THRESHOLD;
      console.log('📏 Distance from last location:', distance, 'meters. Threshold:', LOCATION_THRESHOLD);
    } else {
      hasLocationChanged = true; // First location update
      console.log('🆕 First location update');
    }
    
    console.log('⏰ Update decision:', {
      shouldUpdateByTime,
      hasLocationChanged,
      timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000 / 60) + ' minutes'
    });
    
    // Update if:
    // 1. It's the first location update, OR
    // 2. 30 minutes have passed (regardless of location change), OR
    // 3. Location has changed significantly
    if (!currentLocation || shouldUpdateByTime || hasLocationChanged) {
      console.log('🔄 Proceeding with location update...');
      
      // Get address information
      const addressData = await getAddressFromCoordinates(newLat, newLon);
      
      if (addressData) {
        console.log('📍 Address resolved successfully:', addressData.address);
      } else {
        console.warn('⚠️ Could not resolve address for coordinates');
      }
      
      // Send location update with change indicator
      await updateLocationInDatabase(position, addressData, hasLocationChanged);
      
      setLocationError(null);
    } else {
      console.log('⏸️ Skipping location update (no significant change and time threshold not met)');
    }
  };

  // Handle geolocation errors
  const handleLocationError = (error) => {
    let errorMessage = 'Location access denied';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
      default:
        errorMessage = 'Unknown location error';
    }
    
    console.error('Location error:', errorMessage);
    setLocationError(errorMessage);
  };

  // Start location tracking
  const startTracking = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    // Check browser permission state before prompting
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'denied') {
          setLocationError(
            'Location blocked by browser. Click the lock icon in the address bar → Site settings → Location → Allow, then reload the page.'
          );
          return;
        }
      } catch {
        // Permissions API not fully supported — proceed anyway
      }
    }

    setIsTracking(true);
    setLocationError(null);

    // Get initial location
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );

    // Set up interval to check location every 30 minutes
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }, UPDATE_INTERVAL);

    setTrackingInterval(intervalId);
    return intervalId;
  };

  // Stop location tracking
  const stopTracking = () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
    }
    setIsTracking(false);
  };

  // Auto-start tracking when user logs in
  useEffect(() => {
    // Don't automatically start tracking when user is authenticated
    // Location tracking should only start when explicitly called (after check-in)
    
    // Cleanup on unmount or user logout
    return () => {
      stopTracking();
    };
  }, [user]);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [trackingInterval]);

  // Listen for attendance events to refresh location status
  useEffect(() => {
    if (user) {
      const handleAttendanceEvent = (event) => {
        
        // If it's a check-in event, start tracking
        if (event.detail?.type === 'checkin') {
          setLocationError(null);
          if (!isTracking) {
            startTracking();
          }
        }
        
        // If it's a check-out event, stop tracking
        if (event.detail?.type === 'checkout') {
          stopTracking();
        }
        
        // Refresh current location display regardless of event type
        if (isTracking) {
          navigator.geolocation.getCurrentPosition(
            handleLocationSuccess,
            handleLocationError,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        }
      };

      // Listen for custom attendance events
      window.addEventListener('attendanceUpdate', handleAttendanceEvent);
      
      // Also listen for localStorage changes (in case of multiple tabs)
      const handleStorageChange = (e) => {
        if (e.key === 'attendanceEvent') {
          handleAttendanceEvent({ detail: { type: 'unknown' } });
        }
      };
      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('attendanceUpdate', handleAttendanceEvent);
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [user, isTracking]);

  return {
    currentLocation,
    locationError,
    isTracking,
    lastUpdate,
    startTracking,
    stopTracking
  };
};
