
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/axios";

export default function Signup() {
  const [form, setForm] = useState({ employeeId: "", name: "", email: "", role: "" });
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = async (e) => {
  e.preventDefault();
  setErr("");
  setSuccess("");
  setLoading(true);
  
  try {
    const response = await api.post('http://localhost:5000/api/auth/register', {
      ...form, 
    });
    
    if (response.status === 201) {
      setSuccess({
        message: "Employee registered successfully!",
        email: form.email,
        password: `${form.employeeId}@2025`,
        role: form.role, // include role in success message
      });
      console.log("email : " ,form.email,'password:' ,`${form.employeeId}@2025`,'role:', form.role);
      setForm({ employeeId: "", name: "", email: "", role: "" });
    }

  } catch (error) {
    setErr(error.response?.data?.message || "Registration failed");
  } finally {
    setLoading(false);
  }
};

  return (
  <div className="flex items-center justify-center bg-gradient-to-t from-gray-50 to-gray-100 px-4 pt-2">
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md border border-gray-200 bg-white p-8 shadow-xl"
    >
      {/* Header */}
      <h1 className="text-2xl text-center mb-4 font-bold text-gray-800">Employee Registration</h1>
      <p className="mb-6 text-center text-sm text-gray-600">
        Register new employees. A default password will be generated automatically.
      </p>

      {/* Error */}
      {err && (
        <div className="mb-4  border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-4  border border-green-400 bg-green-50 px-4 py-3 text-sm text-green-700 space-y-2">
          <p className="font-semibold">{success.message}</p>
          <p>Login Credentials:</p>
          <p>• <strong>Email:</strong> {success.email}</p>
          <p>• <strong>Password:</strong> {success.password}</p>
          <p className="italic text-xs">Please save these credentials for login.</p>
        </div>
      )}

      {/* Form Inputs */}
      <div className="space-y-4">
        <input
          name="employeeId"
          placeholder="Employee ID"
          value={form.employeeId}
          onChange={onChange}
          required
          className="w-full  border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <input
          name="name"
          placeholder="Employee Name"
          value={form.name}
          onChange={onChange}
          required
          className="w-full  border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <input
          name="email"
          type="email"
          placeholder="Employee Email"
          value={form.email}
          onChange={onChange}
          required
          className="w-full  border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        <select
          name="role"
          id="role"
          value={form.role}
          onChange={onChange}
          required
          className="w-full  border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Select Role</option>
          <option value="employee">Employee</option>
          <option value="admin">Human Resource - HR</option>
        </select>
      </div>

      {/* Button */}
      <button
        disabled={loading}
        className="mt-6 w-full  bg-gray-800 py-2.5 text-white font-semibold shadow hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Registering..." : "Register Employee"}
      </button>
      
    </form>
  </div>
);

}
