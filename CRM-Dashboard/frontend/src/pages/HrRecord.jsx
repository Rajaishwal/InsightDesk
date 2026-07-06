import React, { useState } from "react";
import AttendanceTab from "../hrRecords/attendence/AttendanceTab";
import { useAuth } from "../context/AuthContext";
import { UserCheck, ClipboardList, CalendarCheck, MapPin, Users, UserPlus2, UserSearchIcon } from "lucide-react";

import TasksTab from "../hrRecords/tasks/TasksTab";
import LeaveTab from "../hrRecords/LeaveTab";
import LocationTab from "../hrRecords/locations/LocationTab";
import EmployeeSearchTab from "../hrRecords/EmployeeSearchTab";
import Signup from "./Signup";

const HrRecord = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("attendance");
  

  const tabs = [
    { id: "attendance", label: "Attendance", icon: <UserCheck className="w-4 h-4 mr-2" /> },
    { id: "tasks", label: "Tasks Manager", icon: <ClipboardList className="w-4 h-4 mr-2" /> },
    { id: "leaves", label: "Leaves Management", icon: <CalendarCheck className="w-4 h-4 mr-2" /> },
    { id: "locations", label: "Locations Access", icon: <MapPin className="w-4 h-4 mr-2" /> },
    { id: "employees", label: "Search Employees", icon: <UserSearchIcon className="w-4 h-4 mr-2" /> },
    { id: "register", label: "Register Employee", icon: <UserPlus2 className="w-4 h-4 mr-2" /> },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 bg-white shadow-sm rounded-2xl p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
        <p className="text-gray-600 mt-1">
          {user?.name ? `Welcome, ${user.name}! ` : ""}Monitor employees and manage HR records
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3 mb-6 border-b border-gray-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-full font-medium transition-all
              ${
                activeTab === tab.id
                  ? "bg-gray-800 text-gray-100 shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white  shadow p-6 border border-gray-100">
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "tasks" && <TasksTab />}
        {activeTab === "leaves" && <LeaveTab />}
        {activeTab === "locations" && <LocationTab />}
        {activeTab === "employees" && <EmployeeSearchTab />}
        {activeTab === "register" && <Signup />}
      </div>
    </div>
  );
};

export default HrRecord;
