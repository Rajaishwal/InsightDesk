import { faUser, faSave, faIdBadge, faHome, faBriefcase, faEdit, faInfoCircle, faVenusMars, faBuilding, faClock, faCamera, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "../services/axios";

const Profile = () => {
  const { user } = useAuth();
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isProfileSavedBefore, setIsProfileSavedBefore] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    employeeId: "",
    gender: "",
    shiftTiming: "",
    designation: "",
    domain: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
    },
  });

  useEffect(() => {
    if (user) {
      const userData = {
        name: user.name || "",
        email: user.email || "",
        employeeId: user.employeeId || "",
        gender: user.gender || "",
        shiftTiming: user.shiftTiming || "",
        designation: user.designation || "",
        domain: user.domain || "",
        address: {
          street: user.address?.street || "",
          city: user.address?.city || "",
          state: user.address?.state || "",
          zipCode: user.address?.zipCode || "",
          country: user.address?.country || "",
        },
      };
      setProfileData(userData);

      const hasBeenSaved =
        userData.gender ||
        userData.designation ||
        userData.domain ||
        userData.shiftTiming ||
        userData.address.street ||
        userData.address.city;

      setIsProfileSavedBefore(hasBeenSaved);
    }
  }, [user]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePhoto(file);

    // Upload immediately on selection
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      const uploadResponse = await axios.post("http://localhost:5000/api/upload", formData);
      const photoUrl = uploadResponse.data.fileUrl;
      await axios.put(`http://localhost:5000/api/users/${user._id}/profile`, { photo: photoUrl });
      alert("Profile photo updated!");
    } catch (error) {
      alert(error.response?.data?.message || "Photo upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (["name", "email", "employeeId"].includes(name)) return;

    if (isProfileSavedBefore) {
      const allowedFields = ["designation", "domain", "shiftTiming"];
      const isAddressField = name.startsWith("address.");
      if (!allowedFields.includes(name) && !isAddressField) return;
    }

    if (name === "gender" && profileData.gender && !isEditingProfile) return;

    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setProfileData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setProfileData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { name, email, employeeId, ...updateableData } = profileData;
      const updateData = { ...updateableData };

      await axios.put(`http://localhost:5000/api/users/${user._id}/profile`, updateData);

      alert("Profile updated successfully!");

      setIsProfileSavedBefore(true);
      setIsEditingProfile(false);
      setIsEditingAddress(false);
    } catch (error) {
      let errorMessage =
        error.response?.data?.message || error.message || "Error updating profile";
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="max-w-7xl mx-auto p-6">
    {/* Profile Section */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-gray-800">
          <FontAwesomeIcon icon={faUser} className="text-blue-600" />
          Employee Profile
        </h2>
        <button
          type="button"
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
            isEditingProfile
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-blue-100 text-blue-600 hover:bg-blue-200"
          }`}
        >
          <FontAwesomeIcon icon={isEditingProfile ? faTimes : faEdit} />
          {isEditingProfile ? "Cancel" : "Edit"}
        </button>
      </div>

      <p className="text-sm text-yellow-600 mb-6 leading-relaxed">
        <FontAwesomeIcon icon={faInfoCircle} className="mr-2 text-gray-400" />
        Name, Email, and Employee ID are system-generated and cannot be modified.
        {isProfileSavedBefore &&
          " After first save, only Designation, Domain/Department, Shift Timing, Profile Photo, and Address can be edited."}
      </p>

      <form onSubmit={handleProfileSubmit} className="space-y-8">
        {/* Basic Info */}
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-700 mb-4">
            <FontAwesomeIcon icon={faIdBadge} className="text-blue-500" />
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Full Name", name: "name", type: "text" },
              { label: "Email", name: "email", type: "email" },
              { label: "Employee ID", name: "employeeId", type: "text" },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                  {field.label}
                </label>
                <input
                  type={field.type}
                  name={field.name}
                  value={profileData[field.name]}
                  onChange={handleInputChange}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 cursor-not-allowed"
                />
              </div>
            ))}

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faVenusMars} className="text-gray-400" />
                Gender
              </label>
              <select
                name="gender"
                value={profileData.gender}
                onChange={handleInputChange}
                disabled={
                  isProfileSavedBefore ||
                  (profileData.gender && !isEditingProfile)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faBriefcase} className="text-gray-400" />
                Designation
              </label>
              <input
                type="text"
                name="designation"
                value={profileData.designation}
                onChange={handleInputChange}
                placeholder="e.g., Software Developer"
                disabled={!isEditingProfile}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
              />
            </div>

            {/* Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faBuilding} className="text-gray-400" />
                Domain/Department
              </label>
              <select
                name="domain"
                value={profileData.domain}
                onChange={handleInputChange}
                disabled={
                  isProfileSavedBefore ||
                  (profileData.domain && !isEditingProfile)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">Select Domain</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
              </select>
            </div>

            {/* Shift Timing */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                Shift Timing
              </label>
              <select
                name="shiftTiming"
                value={profileData.shiftTiming}
                onChange={handleInputChange}
                disabled={profileData.shiftTiming && !isEditingProfile}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">Select Shift Timing</option>
                <option value="07:00 AM - 02:00 PM">07:00 AM - 02:00 PM</option>
                <option value="02:00 PM - 09:00 PM">02:00 PM - 09:00 PM</option>
              </select>
            </div>

            {/* Profile Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faCamera} className="text-gray-400" />
                Profile Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={loading}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4
                           file:rounded-full file:border-0 file:text-sm file:font-semibold
                           file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:cursor-not-allowed"
              />
              {loading && <p className="text-xs text-blue-500 mt-1">Uploading photo...</p>}
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="border-t border-gray-400 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-700">
              <FontAwesomeIcon icon={faHome} className="text-green-500" />
              Address Information
            </h3>
            <button
              type="button"
              onClick={() => setIsEditingAddress(!isEditingAddress)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                isEditingAddress
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-blue-100 text-blue-600 hover:bg-blue-200"
              }`}
            >
              <FontAwesomeIcon icon={isEditingAddress ? faTimes : faEdit} />
              {isEditingAddress ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Street Address", name: "address.street", full: true },
              { label: "City", name: "address.city" },
              { label: "State", name: "address.state" },
              { label: "ZIP Code", name: "address.zipCode" },
              { label: "Country", name: "address.country" },
            ].map((field) => (
              <div key={field.name} className={field.full ? "md:col-span-2" : ""}>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {field.label}
                </label>
                <input
                  type="text"
                  name={field.name}
                  value={
                    field.name.startsWith("address.")
                      ? profileData.address[field.name.split(".")[1]]
                      : profileData[field.name]
                  }
                  onChange={handleInputChange}
                  disabled={!isEditingAddress}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        {(isEditingProfile || isEditingAddress) && (
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-70"
            >
              <FontAwesomeIcon icon={faSave} />
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </form>
    </div>
  </div>
);
};

export default Profile;
