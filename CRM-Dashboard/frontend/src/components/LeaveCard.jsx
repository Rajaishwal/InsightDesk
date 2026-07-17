const LeaveCard = ({ taken, pending, left, monthlyAllocation }) => {
  const total = monthlyAllocation ? monthlyAllocation.totalLeaves : (taken + pending + left) || 1;
  const used = taken + pending;
  const usedPct = Math.min(100, Math.round((used / total) * 100));
  const takenPct = Math.min(100, Math.round((taken / total) * 100));
  const pendingPct = Math.min(100, Math.round((pending / total) * 100));

  return (
    <div className="mx-6 mt-2">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">
            Monthly Leave Balance
          </h2>
          {monthlyAllocation && (
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {new Date(0, monthlyAllocation.month - 1).toLocaleString("default", { month: "long" })} {monthlyAllocation.year}
            </span>
          )}
        </div>

        {/* Stat chips */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col items-center bg-indigo-50 rounded-xl p-4">
            <span className="text-2xl font-bold text-indigo-600">{taken}</span>
            <span className="text-xs text-indigo-500 mt-1 font-medium">Days Taken</span>
          </div>
          <div className="flex flex-col items-center bg-amber-50 rounded-xl p-4">
            <span className="text-2xl font-bold text-amber-500">{pending}</span>
            <span className="text-xs text-amber-500 mt-1 font-medium">Pending</span>
          </div>
          <div className="flex flex-col items-center bg-emerald-50 rounded-xl p-4">
            <span className="text-2xl font-bold text-emerald-600">{left}</span>
            <span className="text-xs text-emerald-600 mt-1 font-medium">Remaining</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{used} used of {total} days</span>
            <span>{usedPct}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${takenPct}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${pendingPct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" /> Taken
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Pending
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-200" /> Remaining
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveCard;