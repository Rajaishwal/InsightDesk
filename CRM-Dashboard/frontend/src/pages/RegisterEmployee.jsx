import React, { useState } from "react";
import axios from "../services/axios";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const RegisterEmployee = ({ setActiveTab }) => {
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    role: "Employee"
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/auth/register", {
        employeeId: form.employeeId,
        name: form.name,
        email: form.email,
        password: `${form.employeeId}@2025`, // Default password
        role: form.role
      });
      alert("Employee registered successfully!");
      if (typeof setActiveTab === "function") {
        setActiveTab("employees");
      } else {
        navigate("/hr");
      }
    } catch (err) {
      alert("Registration failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleClose = () => {
    if (typeof setActiveTab === "function") {
      setActiveTab("employees");
    } else {
      navigate("/hr");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-2xl w-full max-w-md relative border border-gray-200">
        {/* Close Icon */}
        <button
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-700"
          onClick={handleClose}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-center mb-4">Employee Registration</h2>
        <p className="text-center mb-6 text-gray-600">Register new employees. A default password will be generated automatically.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="employeeId"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
          />
          <input
            type="text"
            name="name"
            placeholder="Employee Name"
            value={form.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Employee Email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
          />
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
            disabled
          >
            <option value="Employee">Employee</option>
          </select>
          <button
            type="submit"
            className="w-full bg-gray-800 text-white py-2 rounded-md font-semibold hover:bg-gray-900 transition"
          >
            Register Employee
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterEmployee;
