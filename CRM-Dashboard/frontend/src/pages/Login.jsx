import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, X } from "lucide-react";
import axios from "../services/axios";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/hr");
      else navigate("/");
    }
  }, [user, navigate]);

  // password change states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  // ...existing code...

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { success, message } = await login(form.email, form.password);
    setLoading(false);
    if (!success) return setErr(message);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Sign in to your CRM account</p>
        </div>
        {/* Error */}
        {err && (
          <div className="mb-4  border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-600">
            {err}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={onChange}
              required
              autoComplete="email"
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
                required
                autoComplete="current-password"
                className="w-full border border-gray-300 px-3 py-2 text-sm pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="cursor-pointer" size={18} /> : <Eye className="cursor-pointer" size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer bg-blue-600 text-white font-semibold py-2  hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <p className="mt-2">
            Need to change your password?{' '}
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="text-blue-600 cursor-pointer hover:underline font-medium"
            >
              Reset Password
            </button>
          </p>
        </div>

      </div>

  {/* Password Change Modal removed for cleanup */}
      {/* Password Change Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Change Password
              </h3>
              <button
                onClick={() => setShowChangePassword(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (
                !passwordData.email ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              ) {
                setErr("Please fill in all password fields");
                return;
              }
              if (passwordData.newPassword !== passwordData.confirmPassword) {
                setErr("New password and confirm password do not match");
                return;
              }
              if (passwordData.newPassword.length < 6) {
                setErr("New password must be at least 6 characters long");
                return;
              }
              if (passwordData.currentPassword === passwordData.newPassword) {
                setErr("New password must be different from current password");
                return;
              }

              try {
                setPasswordLoading(true);
                setErr("");
                const loginResponse = await axios.post("http://localhost:5000/api/auth/login", {
                  email: passwordData.email,
                  password: passwordData.currentPassword,
                });

                if (loginResponse.data.token) {
                  await axios.put(
                    "http://localhost:5000/auth/change-password",
                    {
                      currentPassword: passwordData.currentPassword,
                      newPassword: passwordData.newPassword,
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${loginResponse.data.token}`,
                      },
                    }
                  );
                  alert("Password changed successfully! Please login with new password.");
                  setPasswordData({
                    email: "",
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setShowChangePassword(false);
                }
              } catch (error) {
                setErr(
                  error.response?.data?.message ||
                    "Error changing password. Please try again."
                );
              } finally {
                setPasswordLoading(false);
              }
            }} className="space-y-4">
              {err && (
                <div className="mb-2  border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {err}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={passwordData.email}
                  onChange={handlePasswordChange}
                  required
                  className="w-full  border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder="Enter your email"
                />
              </div>

              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    className="w-full  border border-gray-300 px-3 py-2 text-sm pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword(!showCurrentPassword)
                    }
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? <EyeOff className="cursor-pointer" size={18} /> : <Eye className="cursor-pointer" size={18} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    className="w-full  border border-gray-300 px-3 py-2 text-sm pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="cursor-pointer" size={18} /> : <Eye className="cursor-pointer" size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    className="w-full  border border-gray-300 px-3 py-2 text-sm pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="px-4 py-2  bg-red-600 border text-white hover:bg-red-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-medium cursor-pointer hover:bg-blue-700 disabled:opacity-50"
                >
                  {passwordLoading ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

