// RegisterEmployee.jsx — Admin form to register a new employee account
import { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import axios from "../services/axios";
import { useNavigate } from "react-router-dom";
import { X, Loader2 } from "lucide-react";

const RegisterEmployee = ({ setActiveTab }) => {
  const toast    = useToast();
  const navigate = useNavigate();

  const [form, setForm]             = useState({ name: "", email: "" });
  const [nextId, setNextId]         = useState("");
  const [idLoading, setIdLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch next auto-generated employee ID from backend on mount
  useEffect(() => {
    axios.get("/users/next-employee-id")
      .then(r  => setNextId(r.data.nextId))
      .catch(() => toast.error("Could not load next Employee ID"))
      .finally(() => setIdLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nextId) return toast.error("Employee ID not ready yet.");
    setSubmitting(true);
    try {
      await axios.post("/auth/register", {
        employeeId: nextId,
        name:       form.name,
        email:      form.email,
        password:   `${nextId}@2025`,
        role:       "employee",
      });
      toast.success(`Employee registered! Default password: ${nextId}@2025`);
      if (typeof setActiveTab === "function") setActiveTab("employees");
      else navigate("/hr");
    } catch (err) {
      toast.error("Registration failed: " + (err?.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (typeof setActiveTab === "function") setActiveTab("employees");
    else navigate("/hr");
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-2xl w-full max-w-md relative border border-gray-200">

        {/* Close button */}
        <button
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-700"
          onClick={handleClose}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center mb-2">Employee Registration</h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Register new employees. A default password will be generated automatically.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Employee ID — disabled, auto-generated */}
          <div className="relative">
            <input
              type="text"
              value={idLoading ? "Generating…" : nextId}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-100
                         text-gray-500 font-mono tracking-widest cursor-not-allowed"
            />
            {idLoading && (
              <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>

          {/* Employee Name */}
          <input
            type="text"
            name="name"
            placeholder="Employee Name"
            value={form.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
          />

          {/* Employee Email */}
          <input
            type="email"
            name="email"
            placeholder="Employee Email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring"
            required
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || idLoading}
            className="w-full bg-gray-800 text-white py-2 rounded-md font-semibold
                       hover:bg-gray-900 transition flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Registering…" : "Register Employee"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default RegisterEmployee;