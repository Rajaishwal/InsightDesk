import React, { useState } from "react";
import PrjTeamModle from "./PrjTeamModle";

const PrjModle = ({ project, onClose, isHrView = false }) => {
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  const handleTeamView = () => {
    setTeamMembers(project.teamMembers || []);
    setShowTeamModal(true);
  };

  if (!project) return null;

  const handleContact = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      project.email
    )}&su=${encodeURIComponent(
      `Regarding Project: ${project.title}`
    )}&body=${encodeURIComponent(
      `Hello ${project.manager},\n\nI would like to discuss about the project.`
    )}`;
    window.open(gmailUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-white p-6 shadow-2xl w-full max-w-lg relative animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition text-2xl"
        >
          &times;
        </button>

        <h1 className="text-2xl text-center font-bold mb-6 text-gray-800 border-b pb-3">
          Project Details
        </h1>

        <div className="space-y-3">
          <p className="text-gray-700">
            <span className="font-semibold">Project ID:</span> {project.projectId}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Title:</span> {project.title}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Description:</span> {project.description}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Manager:</span> {project.manager}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Email:</span> {project.email}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Skills:</span> {project.skills || project.Skill || ""}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Tools:</span> {project.tools || project.tool || ""}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Status:</span> {project.status}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-white bg-red-600 hover:bg-red-800 transition"
          >
            Close
          </button>

          {isHrView ? (
            <button
              onClick={handleTeamView}
              className="px-5 py-2 bg-blue-600 text-white shadow hover:bg-blue-700 transition"
            >
              Team Members
            </button>
          ) : (
            <button
              onClick={handleContact}
              className="px-5 py-2 bg-green-600 text-white shadow hover:bg-green-700 transition"
            >
              Contact
            </button>
          )}
        </div>

        {showTeamModal && (
          <PrjTeamModle
            teamMembers={teamMembers}
            onClose={() => setShowTeamModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default PrjModle;
