// FileUploader.jsx — drag-drop / click file picker with Cloudinary upload
import { useRef, useState } from "react";
import { Paperclip, X, FileText, FileImage, File, Loader2 } from "lucide-react";
import api from "../services/axios";

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

const typeIcon = (type = "") => {
  if (type.startsWith("image/")) return <FileImage size={14} className="text-indigo-400" />;
  if (type === "application/pdf") return <FileText size={14} className="text-red-400" />;
  return <File size={14} className="text-gray-400" />;
};

const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Props:
 *   attachments   — array of { url, name, type }
 *   onChange      — (newAttachments) => void
 *   maxFiles      — default 5
 *   disabled      — bool
 */
export default function FileUploader({ attachments = [], onChange, maxFiles = 5, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (files) => {
    if (!files?.length) return;
    const remaining = maxFiles - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return { url: res.data.fileUrl, name: file.name, type: file.type };
        })
      );
      onChange([...attachments, ...results]);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Check file type/size.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (idx) => onChange(attachments.filter((_, i) => i !== idx));

  const onDrop = (e) => {
    e.preventDefault();
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      {attachments.length < maxFiles && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={`flex items-center gap-2 px-3 py-2.5 border border-dashed rounded-xl cursor-pointer transition
            ${disabled || uploading ? "opacity-50 cursor-not-allowed border-gray-200" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40"}`}
        >
          {uploading
            ? <Loader2 size={15} className="text-indigo-400 animate-spin" />
            : <Paperclip size={15} className="text-gray-400" />}
          <span className="text-xs text-gray-400">
            {uploading ? "Uploading…" : "Attach files — images, PDF, Word, Excel (max 10 MB each)"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* File list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {typeIcon(f.type)}
              <a href={f.url} target="_blank" rel="noreferrer"
                className="flex-1 text-xs text-gray-700 font-medium truncate hover:text-indigo-600 transition">
                {f.name}
              </a>
              {!disabled && (
                <button type="button" onClick={() => remove(i)}
                  className="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}