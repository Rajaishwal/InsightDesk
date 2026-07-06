import React, { useState, useEffect } from "react";
import api from "../../services/axios";
import LocationFilters from "./LocationFilters";

const LocationTab = () => {
  const [employeeLocations, setEmployeeLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationFilters, setLocationFilters] = useState({
    searchTerm: '',
    sortBy: 'lastUpdated',
    sortOrder: 'desc'
  });
  const [showLocationHistory, setShowLocationHistory] = useState({});
  const [locationHistoryData, setLocationHistoryData] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});
  const [autoRefreshOnEvents, setAutoRefreshOnEvents] = useState(true);

  // Fetch all employee locations
  const fetchEmployeeLocations = async () => {
    try {
      setLocationsLoading(true);
      console.log('Fetching employee locations...');
      const response = await api.get("http://localhost:5000/api/location/all-employees");
      console.log('Employee locations response:', response.data);
      
      if (response.data.success) {
        setEmployeeLocations(response.data.employees);
        console.log('Set employee locations:', response.data.employees);
      } else {
        console.error('Failed to fetch locations:', response.data.message);
        alert("Failed to fetch employee locations: " + response.data.message);
      }
    } catch (error) {
      console.error("Error fetching employee locations:", error);
      if (error.response?.status === 403) {
        alert("Access denied. You don't have permission to view employee locations.");
      } else if (error.response?.status === 401) {
        alert("Authentication required. Please log in again.");
      } else {
        alert("Failed to fetch employee locations: " + (error.response?.data?.message || error.message));
      }
    } finally {
      setLocationsLoading(false);
    }
  };

  // Filter and sort employees
  const getFilteredLocations = () => {
    let filtered = employeeLocations.filter(emp => {
      const term = locationFilters.searchTerm.toLowerCase();
      return (
        emp.name.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term) ||
        emp.employeeId.toLowerCase().includes(term)
      );
    });

    const { sortBy, sortOrder } = locationFilters;
    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else {
        aVal = new Date(a.currentLocation?.lastUpdated || 0);
        bVal = new Date(b.currentLocation?.lastUpdated || 0);
      }

      if (sortOrder === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  };

  // Fetch location history for one employee
  const fetchEmployeeLocationHistory = async (userId) => {
    try {
      setHistoryLoading(prev => ({ ...prev, [userId]: true }));
      console.log('Fetching location history for user:', userId);
      
      const response = await api.get(`http://localhost:5000/api/location/history?userId=${userId}&limit=10`);
      console.log('Location history response:', response.data);
      
      if (response.data.success) {
        console.log('Location history data:', response.data.locations);
        setLocationHistoryData(prev => ({ ...prev, [userId]: response.data.locations }));
      } else {
        console.log('Failed to fetch location history:', response.data.message);
        setLocationHistoryData(prev => ({ ...prev, [userId]: [] }));
        alert(`No location history found for this employee: ${response.data.message}`);
      }
    } catch (error) {
      console.error("Error fetching location history:", error);
      setLocationHistoryData(prev => ({ ...prev, [userId]: [] }));
      alert(`Failed to fetch history for employee ${userId}. You may not have permission.`);
    } finally {
      setHistoryLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Toggle history dropdown
  const toggleLocationHistory = async (userId) => {
    const isOpen = showLocationHistory[userId];
    setShowLocationHistory(prev => ({ ...prev, [userId]: !isOpen }));

    if (!isOpen && !locationHistoryData[userId]) {
      await fetchEmployeeLocationHistory(userId);
    }
  };

  // Refresh all locations
  const refreshLocations = () => fetchEmployeeLocations();

  // Clear only inactive employee location data
  const clearAllInactiveData = async () => {
    // if (!window.confirm('Are you sure you want to clear all inactive employee location data? This action cannot be undone.')) {
    //   return;
    // }

    try {
      // First, identify inactive employees locally
      const activeEmployees = employeeLocations.filter(emp => {
        const status = getLocationStatus(emp.currentLocation, emp.attendanceStatus);
        return status.status === 'active';
      });

      // Update the table immediately to show only active employees
      setEmployeeLocations(activeEmployees);
      
      // Then call the backend to clean up the database
      const response = await api.delete('http://localhost:5000/api/location/clear-inactive');
      if (response.data.success) {
        alert(`Successfully cleared ${response.data.deletedCount} inactive location records from ${response.data.clearedUsers} users.`);
        // Clear any open history data for removed employees
        setLocationHistoryData({});
        setShowLocationHistory({});
      } else {
        alert('Failed to clear inactive data: ' + response.data.message);
        // If backend failed, refresh to get accurate data
        await fetchEmployeeLocations();
      }
    } catch (error) {
      console.error('Error clearing inactive data:', error);
      alert('Failed to clear inactive data: ' + (error.response?.data?.message || error.message));
      // If there was an error, refresh to get accurate data
      await fetchEmployeeLocations();
    }
  };

  // Generate Google Maps link
  const getGoogleMapsLink = (lat, lng) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // Auto-refresh every 30s
  useEffect(() => {
    fetchEmployeeLocations();
    const interval = setInterval(() => fetchEmployeeLocations(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh on events
  useEffect(() => {
    if (!autoRefreshOnEvents) return;
    const handleEvent = () => fetchEmployeeLocations();
    window.addEventListener("attendanceUpdate", handleEvent);
    window.addEventListener("storage", (e) => e.key === "attendanceEvent" && handleEvent());
    return () => {
      window.removeEventListener("attendanceUpdate", handleEvent);
      window.removeEventListener("storage", handleEvent);
    };
  }, [autoRefreshOnEvents]);


  // Get location status
  const getLocationStatus = (currentLocation, attendanceStatus) => {
    // Check if employee is checked in and has recent location data
    if (attendanceStatus === 'checked-in' && currentLocation) {
      const lastUpdated = new Date(currentLocation.lastUpdated);
      const now = new Date();
      const diffInMinutes = (now - lastUpdated) / (1000 * 60);
      
      if (diffInMinutes <= 30) {
        return { status: 'active', color: 'bg-white text-green-500 border-green-500 border-2 border-solid', text: 'Active' };
      }
    }
    
    // All other cases are inactive
    return { status: 'inactive', color: 'bg-white text-red-500 border-red-500 border-2 border-solid', text: 'Inactive' };
  };

  // Stats
  const totalEmployees = employeeLocations.length;
  const activeLocations = employeeLocations.filter(emp => {
    const status = getLocationStatus(emp.currentLocation, emp.attendanceStatus);
    return status.status === 'active';
  }).length;
  const inactiveLocations = totalEmployees - activeLocations;

  return (
    <div className="locations-tab space-y-6 p-4">

      {/* Header */}
      <div className="tab-header flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">📍 Employee Locations</h2>
        <div className="header-actions flex flex-wrap gap-2">
          <button
            onClick={refreshLocations}
            disabled={locationsLoading}
            className="px-3 py-2 rounded bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 transition disabled:opacity-50 text-sm"
          >
            {locationsLoading ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
          <button
            onClick={clearAllInactiveData}
            disabled={locationsLoading}
            className="px-3 py-2 rounded bg-red-100 text-red-800 font-medium hover:bg-red-200 transition disabled:opacity-50 text-sm"
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <LocationFilters filters={locationFilters} setFilters={setLocationFilters} />

      {/* Stats */}
      <div className="location-stats grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="stat-card bg-gray-50 shadow rounded-lg p-4 flex flex-col items-center">
          <h4 className="text-gray-500 text-sm font-medium">Total Employees</h4>
          <span className="text-2xl font-semibold">{totalEmployees}</span>
        </div>
        <div className="stat-card bg-gray-50 shadow rounded-lg p-4 flex flex-col items-center">
          <h4 className="text-gray-500 text-sm font-medium">Active Locations</h4>
          <span className="text-2xl font-semibold text-green-600">{activeLocations}</span>
        </div>
        <div className="stat-card bg-gray-50 shadow rounded-lg p-4 flex flex-col items-center">
          <h4 className="text-gray-500 text-sm font-medium">Inactive Locations</h4>
          <span className="text-2xl font-semibold text-red-600">{inactiveLocations}</span>
        </div>
      </div>

      {/* Employee Locations Table */}
      {locationsLoading ? (
        <div className="loading-state flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 text-lg font-medium">Loading employee locations...</p>
        </div>
      ) : (
        <div className="employee-table-container">
          {getFilteredLocations().length > 0 ? (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Map
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      History
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredLocations().map(emp => {
                    const locationStatus = getLocationStatus(emp.currentLocation, emp.attendanceStatus);
                    return (
                      <React.Fragment key={emp._id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{emp.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{emp.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono text-gray-700">{emp.employeeId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${locationStatus.color}`}>
                              {locationStatus.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono text-gray-700">
                              {emp.currentLocation
                                ? `${emp.currentLocation.latitude.toFixed(4)}, ${emp.currentLocation.longitude.toFixed(4)}`
                                : "No location available"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {emp.currentLocation
                                ? new Date(emp.currentLocation.lastUpdated).toLocaleString()
                                : "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {emp.currentLocation && (
                              <a
                                href={getGoogleMapsLink(emp.currentLocation.latitude, emp.currentLocation.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8 text-white rounded-full hover:bg-blue-100 transition-colors"
                                title="View on Map"
                              >
                                📍
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => toggleLocationHistory(emp._id)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition"
                            >
                              {showLocationHistory[emp._id] ? "Hide" : "Show"}
                            </button>
                          </td>
                        </tr>
                        {showLocationHistory[emp._id] && (
                          <tr>
                            <td colSpan="8" className="px-6 py-4 bg-gray-50">
                              <div className="text-sm">
                                {historyLoading[emp._id] ? (
                                  <p className="text-center text-gray-500">Loading history...</p>
                                ) : locationHistoryData[emp._id]?.length > 0 ? (
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {locationHistoryData[emp._id].map((loc, index) => (
                                      <div key={index} className="text-xs border-b border-gray-200 pb-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-gray-600">
                                            {new Date(loc.timestamp).toLocaleString()}
                                          </span>
                                          <span className="text-gray-500 font-mono mx-2">
                                            {loc.coordinates ? 
                                              `${loc.coordinates.latitude?.toFixed(4) || 'N/A'}, ${loc.coordinates.longitude?.toFixed(4) || 'N/A'}` :
                                              loc.latitude && loc.longitude ? 
                                                `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : 
                                                'No coordinates'
                                            }
                                          </span>
                                          {loc.address && (
                                            <span className="text-gray-400 flex-1 truncate">
                                              {loc.address}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-center text-gray-500">No history available</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data text-center py-16 text-gray-500">
              <p className="text-lg font-semibold">No employee location data found</p>
              <small className="text-gray-400">Employees need to log in and enable location tracking</small>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default LocationTab;
