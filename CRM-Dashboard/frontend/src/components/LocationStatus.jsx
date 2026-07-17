import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { MapPin, RefreshCw, AlertCircle } from "lucide-react";

const LocationStatus = () => {
  const { locationTracker, user } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const { currentLocation, locationError, isTracking, startTracking } = locationTracker || {};

  const retryLocationAccess = async () => {
    setIsRetrying(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      );
      if (startTracking) startTracking();
    } catch (error) {
      let msg = "Failed to enable location";
      if (error.code === 1) msg = "Location access denied. Enable location permissions in your browser.";
      else if (error.code === 2) msg = "Location unavailable. Check your device settings.";
      else if (error.code === 3) msg = "Location request timed out.";
      else msg = error.message || "Unknown error accessing location";
      alert(msg);
    } finally {
      setIsRetrying(false);
    }
  };

  const dotColor = locationError
    ? "bg-red-500"
    : isTracking && currentLocation
    ? "bg-green-500"
    : isTracking
    ? "bg-yellow-400 animate-pulse"
    : "bg-gray-400";

  const statusText = locationError && locationError.includes("check-in")
    ? "Requires Check-in"
    : locationError
    ? "Location Error"
    : isTracking && currentLocation
    ? "Active"
    : isTracking
    ? "Getting Location..."
    : "Inactive";

  if (!user) return null;

  return (
    <div className="p-4 mb-4 mr-7 space-y-3">

      {/* Status row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-sm font-medium text-gray-700">{statusText}</span>
        </div>

        {!isTracking && (
          <button
            onClick={retryLocationAccess}
            disabled={isRetrying || (locationError && locationError.includes("check-in"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white
              bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500
              disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
            title={
              locationError?.includes("check-in")
                ? "Please check in first"
                : "Enable location tracking"
            }
          >
            {isRetrying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {isRetrying ? "Enabling..." : locationError?.includes("check-in") ? "Check-in Required" : "Enable"}
          </button>
        )}
      </div>

      {/* Coordinates + address — shown when tracking is active */}
      {isTracking && currentLocation && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
          {/* Coordinates */}
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="font-mono text-xs font-semibold text-gray-700">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </span>
          </div>

          {/* Address */}
          {currentLocation.address ? (
            <p className="text-xs text-gray-500 leading-relaxed pl-5">
              {currentLocation.address}
            </p>
          ) : (
            <p className="text-xs text-gray-400 pl-5 italic">Resolving address...</p>
          )}

          {/* Last updated */}
          {currentLocation.timestamp && (
            <p className="text-[10px] text-gray-400 pl-5">
              Updated {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Error banner */}
      {locationError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{locationError}</p>
            {(locationError.includes("blocked") || locationError.includes("denied")) && (
              <p className="mt-1 text-red-500">
                Click the <strong>lock icon</strong> in the address bar → <strong>Site settings</strong> → Location → <strong>Allow</strong> → reload.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationStatus;