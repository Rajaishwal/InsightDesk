import React from "react";

const LocationFilters = ({ filters, setFilters }) => (
  <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4">
    <input
      type="text"
      placeholder="Search by name or email..."
      value={filters.searchTerm}
      onChange={(e) =>
        setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))
      }
      className="w-full sm:w-2/3 px-3 py-2 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
    />

    <select
      value={filters.sortBy}
      onChange={(e) =>
        setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
      }
      className="w-full sm:w-1/3 px-3 py-2 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <option value="lastUpdated" >Last Updated</option>
      <option value="name">Name</option>
    </select>
  </div>
);

export default LocationFilters;
