import React, { useState } from "react";
import "../Styles/TimesheetsAndLeaves.scss";
import LeaveCard from "../components/LeaveCard";

const TimesheetsAndLeaves = () => {
  const [timesheets, setTimesheets] = useState([
    { date: "2025-07-29", hours: 8, project: "CRM Revamp", status: "Approved" },
    { date: "2025-07-28", hours: 6, project: "API Integration", status: "Pending" },
  ]);

  const [leaves, setLeaves] = useState([
    { date: "2025-08-01", type: "Sick Leave", status: "Approved" },
    { date: "2025-08-10", type: "Casual Leave", status: "Pending" },
  ]);

  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [newTimesheet, setNewTimesheet] = useState({ date: "", hours: "", project: "" });
  const [newLeave, setNewLeave] = useState({ date: "", type: "" });

  const handleAddTimesheet = () => {
    setTimesheets([...timesheets, { ...newTimesheet, status: "Pending" }]);
    setShowTimesheetModal(false);
    setNewTimesheet({ date: "", hours: "", project: "" });
  };

  const handleAddLeave = () => {
    setLeaves([...leaves, { ...newLeave, status: "Pending" }]);
    setShowLeaveModal(false);
    setNewLeave({ date: "", type: "" });
  };

  const taken = leaves.filter((l) => l.status === "Approved").length;
  const pending = leaves.filter((l) => l.status === "Pending").length;
  const maxWeeklyLeaves = 5;
  const left = Math.max(0, maxWeeklyLeaves - taken - pending);



  return (
    <div className="page-container">
      <h2 className="page-title">Timesheets & Leaves</h2>
      <LeaveCard taken={taken} pending={pending} left={left}/>
      {/* Timesheet Section */}
      <div className="card">
        <div className="card-header">
          <h3>Timesheet Entries</h3>
          <button onClick={() => setShowTimesheetModal(true)}>+ Add Entry</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Hours</th>
              <th>Project</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {timesheets.map((entry, idx) => (
              <tr key={idx}>
                <td>{entry.date}</td>
                <td>{entry.hours}</td>
                <td>{entry.project}</td>
                <td className={entry.status.toLowerCase()}>{entry.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leave Section */}
      <div className="card">
        <div className="card-header green">
          <h3>Leave Requests</h3>
          <button onClick={() => setShowLeaveModal(true)}>+ Request Leave</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Leave Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave, idx) => (
              <tr key={idx}>
                <td>{leave.date}</td>
                <td>{leave.type}</td>
                <td className={leave.status.toLowerCase()}>{leave.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Timesheet Modal */}
      {showTimesheetModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Timesheet Entry</h3>
            <input
              type="date"
              value={newTimesheet.date}
              onChange={(e) => setNewTimesheet({ ...newTimesheet, date: e.target.value })}
              placeholder="Date"
            />
            <input
              type="number"
              value={newTimesheet.hours}
              onChange={(e) => setNewTimesheet({ ...newTimesheet, hours: e.target.value })}
              placeholder="Hours"
            />
            <input
              type="text"
              value={newTimesheet.project}
              onChange={(e) => setNewTimesheet({ ...newTimesheet, project: e.target.value })}
              placeholder="Project"
            />
            <div className="modal-actions">
              <button onClick={handleAddTimesheet}>Submit</button>
              <button className="cancel" onClick={() => setShowTimesheetModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Request Leave</h3>
            <input
              type="date"
              value={newLeave.date}
              onChange={(e) => setNewLeave({ ...newLeave, date: e.target.value })}
              placeholder="Date"
            />
            <input
              type="text"
              value={newLeave.type}
              onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
              placeholder="Leave Type"
            />
            <div className="modal-actions">
              <button onClick={handleAddLeave}>Submit</button>
              <button className="cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetsAndLeaves;
