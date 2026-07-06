import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { MapPin, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

const LocationStatus = () => {
  const { locationTracker, user } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const { currentLocation, locationError, isTracking, startTracking } = locationTracker || {};

  const retryLocationAccess = async () => {
    setIsRetrying(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        })
      );
      if (startTracking) startTracking();
    } catch (error) {
      console.error("Error enabling location:", error);
      let errorMessage = "Failed to enable location";
      switch (error.code) {
        case 1:
          errorMessage = "Location access denied. Enable location permissions.";
          break;
        case 2:
          errorMessage = "Location unavailable. Check your device settings.";
          break;
        case 3:
          errorMessage = "Location request timed out.";
          break;
        default:
          errorMessage = error.message || "Unknown error accessing location";
      }
      alert(errorMessage);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusColor = () => {
    if (locationError) return "bg-red-500";
    if (isTracking && currentLocation) return "bg-green-500";
    if (isTracking) return "bg-yellow-400 animate-pulse";
    return "bg-gray-400";
  };

  const getStatusText = () => {
    if (locationError && locationError.includes("check-in")) return "Requires Check-in";
    if (locationError) return "Location Error";
    if (isTracking && currentLocation) return "Active";
    if (isTracking) return "Getting Location...";
    return "Inactive";
  };

  if (!user) return null;

  return (
    <div className="p-4 mb-4 mr-7 ">
      <div className="flex gap-5">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="font-medium text-gray-700">{getStatusText()}</span>
        </div>

        {!isTracking && (
         <button
            onClick={retryLocationAccess}
            disabled={isRetrying || (locationError && locationError.includes("check-in"))}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-white 
                        bg-gradient-to-r from-blue-600 to-blue-400 
                        hover:from-blue-700 hover:to-blue-500 
                        disabled:opacity-60 disabled:cursor-not-allowed 
                        transition-all duration-200 ease-in-out shadow-md`}
            title={
              locationError && locationError.includes("check-in")
                ? "Please check in first to enable location"
                : "Enable location tracking"
            }
          >
            {isRetrying ? (
              <RefreshCw className="animate-spin w-5 h-5" />
            ) : (
              <MapPin className="w-5 h-5" />
            )}
            <span className="text-sm">
              {isRetrying
                ? "Enabling..."
                : locationError && locationError.includes("check-in")
                ? "Check-in Required"
                : "Enable"}
            </span>
          </button>

        )}
      </div>

      {locationError && (
        <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{locationError}</p>
            {locationError.includes('blocked') || locationError.includes('denied') ? (
              <p className="mt-1 text-xs text-red-500">
                To fix: click the <strong>lock icon</strong> in your browser address bar → <strong>Site settings</strong> → set Location to <strong>Allow</strong> → reload the page.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationStatus;
