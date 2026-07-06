import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { technicalProblems } from "../data";
import { useAuth } from "../context/AuthContext";

const RaiseTicket = ({ isOpen, onClose, onSubmit }) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    priority: "Low",
    description: "",
    problem: "",
    image: "",
  });

  const [profileData, setProfileData] = useState({
    name: "",
    employeeId: "",
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        employeeId: user.employeeId || "",
      });
    }
  }, [user]);

  const generateTicketId = () => {
    return "TCK-" + Math.floor(1000 + Math.random() * 9000);
  };

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        subject: generateTicketId(),
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file.name,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    onSubmit(formData);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      "crm@support.in"
    )}&su=${encodeURIComponent(
      `Regarding Bugs fixing in : ${formData.category}`
    )}&body=${encodeURIComponent(
      `Hello Support Team,\n\nTicket ID: ${formData.subject}\nIssue: "${formData.problem}"\n\nDescription:\n${formData.description}\n\nPriority: ${formData.priority}\n\nScreenshot File: ${formData.image || "No file attached"} (suggested to upload again from gmail) \n\nThanks,\n${
        profileData.name
      }\nEMP ID : ${profileData.employeeId}`
    )}`;

    window.open(gmailUrl, "_blank");

    setFormData({
      subject: generateTicketId(),
      category: "",
      priority: "Low",
      description: "",
      problem: "",
      image: "",
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md p-6 shadow-md relative border border-gray-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <h2 className="text-lg font-semibold mb-2 text-center text-gray-800 uppercase">
          Raise a Ticket
        </h2>
        <hr className="mb-6 border-gray-300" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticket ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ticket ID
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              disabled
              className="w-full mt-1 px-3 py-2 border bg-gray-100 text-gray-700 cursor-not-allowed"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full mt-1 px-3 py-2 border border-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Select Category</option>
              <option value="IT Support">IT Support</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Problem */}
          {formData.category && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Technical Problem
              </label>
              <select
                name="problem"
                value={formData.problem}
                onChange={handleChange}
                required
                className="w-full mt-1 px-3 py-2 border border-gray-400 focus:ring-1 focus:ring-green-500 focus:outline-none"
              >
                <option value="">Select Problem</option>
                {technicalProblems[formData.category]?.map((problem, idx) => (
                  <option key={idx} value={problem}>
                    {problem}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border border-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="Describe your issue..."
            ></textarea>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Photo
            </label>
            <input
              type="file"
              accept="image/*"
              name="image"
              onChange={handlePhotoChange}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 
                        file:rounded-lg file:border-0 file:text-sm file:font-medium 
                        file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-red-500 font-medium text-white hover:bg-red-600 shadow-md transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md transition"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseTicket;
