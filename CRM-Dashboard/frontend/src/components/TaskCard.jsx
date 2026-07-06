import { useState } from "react";
import { useAuth } from '../context/AuthContext';
import api from '../services/axios';

const TaskCard = ({ onClose, onSave, taskName, taskDesc, timeTaken }) => {
  const [title, setTitle] = useState(taskName || "");
  const [description, setDescription] = useState(taskDesc || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const handleSaveClick = async () => {
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Prepare task data for API matching the simplified schema
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        taskCompletionTime: timeTaken || "00:00:00"
      };

      // Call API to create task
      const response = await api.post('http://localhost:5000/api/tasks', taskData);
      
      if (response.data.success) {
        // Call the original onSave callback if provided
        if (typeof onSave === 'function') {
          onSave(title, description, timeTaken);
        }
        
        // Clear form and close modal
        setTitle("");
        setDescription("");
        onClose();
        
        // Optional: Show success message
        console.log('Task saved successfully:', response.data.task);
      }
    } catch (err) {
      console.error('Error saving task:', err);
      setError(err.response?.data?.message || 'Failed to save task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-5">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 animate-[modalAppear_0.3s_ease-out]">
        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Task</h2>

        {/* Form */}
        <div className="mb-6 space-y-4">
          <input
            type="text"
            placeholder="Task Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          />

          <textarea
            placeholder="Task Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            disabled={isLoading}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base resize-y min-h-[100px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {timeTaken && (
            <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-lg font-semibold text-center">
              Time Taken: {timeTaken}
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg font-medium text-sm text-center">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 sm:flex-row flex-col">
          <button
            onClick={handleSaveClick}
            disabled={isLoading || !title.trim() || !description.trim()}
            className="px-6 py-3 bg-blue-500 text-white border border-blue-500 rounded-lg text-sm font-semibold hover:bg-blue-600 hover:border-blue-600 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed active:translate-y-0 transition-all"
          >
            {isLoading ? "Saving..." : "Save Task"}
          </button>
        </div>
      </div>
    </div>

  );
};

export default TaskCard;
