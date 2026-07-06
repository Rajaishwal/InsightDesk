const PrjTeamModle = ({ teamMembers = [], projectTitle = "", onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Team Members</h2>
            {projectTitle && (
              <p className="text-xs text-gray-400 mt-0.5">{projectTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {teamMembers.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm font-medium text-gray-500">No team members assigned</p>
              <p className="text-xs text-gray-400 mt-1">This project has no members yet.</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 rounded-lg">
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Emp ID</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamMembers.map((member, i) => (
                  <tr key={member.empId || i} className="hover:bg-gray-50 transition">
                    <td className="py-2.5 px-4 text-sm font-medium text-indigo-600">{member.empId}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{member.empEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrjTeamModle;
