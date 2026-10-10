// HrRecord.jsx — HR Dashboard: one tab bar over Attendance, Tasks, Leaves, Locations, Employee search and Registration.
import { useState } from "react";
import AttendanceTab from "../hrRecords/attendence/AttendanceTab";
import { useAuth } from "../context/AuthContext";
import { UserCheck, ClipboardList, CalendarCheck, MapPin, UserPlus2, UserSearch } from "lucide-react";

import TasksTab from "../hrRecords/tasks/TasksTab";
import LeaveTab from "../hrRecords/LeaveTab";
import LocationTab from "../hrRecords/locations/LocationTab";
import EmployeeSearchTab from "../hrRecords/EmployeeSearchTab";
import RegisterEmployee from "./RegisterEmployee";

const TABS = [
  { id: "attendance", label: "Attendance",        Icon: UserCheck },
  { id: "tasks",      label: "Tasks Manager",     Icon: ClipboardList },
  { id: "leaves",     label: "Leaves Management", Icon: CalendarCheck },
  { id: "locations",  label: "Locations Access",  Icon: MapPin },
  { id: "employees",  label: "Search Employees",  Icon: UserSearch },
  { id: "register",   label: "Register Employee", Icon: UserPlus2 },
];

const HrRecord = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("attendance");
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {firstName ? `Welcome back, ${firstName}. ` : ""}Attendance, tasks, leave and locations for the whole team.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-5 overflow-x-auto pb-1">
        <div role="tablist" aria-label="HR sections" className="inline-flex gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300
                  ${active ? "bg-gray-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"}`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — Attendance brings its own cards; the other tabs sit in a white card */}
      {activeTab === "attendance" ? (
        <AttendanceTab />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {activeTab === "tasks" && <TasksTab />}
          {activeTab === "leaves" && <LeaveTab />}
          {activeTab === "locations" && <LocationTab />}
          {activeTab === "employees" && <EmployeeSearchTab />}
          {activeTab === "register" && <RegisterEmployee setActiveTab={setActiveTab} />}
        </div>
      )}
    </div>
  );
};

export default HrRecord;
