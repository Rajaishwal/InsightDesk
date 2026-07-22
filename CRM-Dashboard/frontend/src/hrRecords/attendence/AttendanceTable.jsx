import { useState, useEffect } from "react";

const AttendanceTable = ({ data, loading }) => {
  const [now, setNow] = useState(new Date());

  // Tick every second while any employee is still checked in
  useEffect(() => {
    const hasActive = data.some((r) => r.status === "checked-in");
    if (!hasActive) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [data]);

  if (loading)
    return (
      <div className="text-center py-10 text-gray-500 font-medium">
        Loading attendance records...
      </div>
    );

  if (!data.length)
    return (
      <div className="text-center py-10 text-gray-500 font-medium">
        No attendance records found.
      </div>
    );

  const liveHours = (checkInTime) => {
    const ms = now - new Date(checkInTime);
    const totalMins = Math.floor(ms / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return { hrs, mins };
  };

  const formatBreak = (minutes) => {
    if (!minutes || minutes === 0) return null;
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="overflow-x-auto bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr className="shadow-md">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check In
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check Out
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Working Hours
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Break
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((record) => {
            const isActive = record.status === "checked-in";

            let hoursDisplay;
            if (isActive) {
              const { hrs, mins } = liveHours(record.checkInTime);
              hoursDisplay = (
                <span className="text-blue-600 font-semibold tabular-nums">
                  {hrs} hrs {mins} mins
                </span>
              );
            } else {
              const hrs = Math.floor(record.workingHours || 0);
              const mins = Math.round(((record.workingHours || 0) % 1) * 60);
              hoursDisplay = (
                <span className={record.workingHours > 8 ? "text-red-600" : "text-green-600"}>
                  {hrs} hrs {mins} mins
                </span>
              );
            }

            const breakMins = record.breakDurationMinutes || 0;
            const breakLabel = formatBreak(breakMins);
            const breakColor =
              breakMins === 0
                ? "text-gray-400"
                : breakMins <= 5
                  ? "text-green-600"
                  : "text-red-600";

            return (
              <tr key={record._id} className="hover:bg-gray-50 transition shadow-sm">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.userName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(record.checkInTime).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(record.checkInTime).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.checkOutTime ? (
                    <span className="text-gray-500">
                      {new Date(record.checkOutTime).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-yellow-600 font-medium">N/A</span>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {hoursDisplay}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={breakColor}>
                    {breakLabel || <span className="text-gray-300">—</span>}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-medium border ${record.status === "checked-in"
                      ? "border-green-500 text-green-600"
                      : record.status === "checked-out"
                        ? "border-red-500 text-red-600"
                        : "border-gray-400 text-gray-600"
                      }`}
                  >
                    {record.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;