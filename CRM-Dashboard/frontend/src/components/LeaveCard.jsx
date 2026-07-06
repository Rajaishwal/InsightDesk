import { useAuth } from "../context/AuthContext";

const LeaveCard = ({ taken, pending, left }) => {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-700 text-white shadow-md hover:shadow-lg transition-shadow duration-300 p-6 rounded-lg">
            <h4 className="text-lg font-bold uppercase mb-4">Total Days Leave</h4>
            <h1 className="text-3xl font-bold text-blue-100">{taken}</h1>
          </div>

          <div className="bg-gray-700 text-white shadow-md hover:shadow-lg transition-shadow duration-300 p-6 rounded-lg">
            <h4 className="text-lg font-bold uppercase mb-4">Leave Pending</h4>
            <h1 className="text-3xl font-bold text-yellow-500">{pending}</h1>
          </div>

          <div className="bg-gray-700 text-white shadow-md hover:shadow-lg transition-shadow duration-300 p-6 rounded-lg">
            <h4 className="text-lg font-bold uppercase mb-4">Monthly Leave Remaining</h4>
            <h1 className="text-3xl font-bold text-green-400">{left}</h1>
          </div>
        </div>
      </div>

  )
}

export default LeaveCard
