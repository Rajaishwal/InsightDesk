// frontend/src/services/axios.js — The one API client. Calls use paths relative to API_BASE ("/users/…", never a full
// URL), so pointing the app at another server only needs VITE_API_BASE at build time.
import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
// The server itself (the chat socket connects here): API_BASE's origin, or this site when API_BASE is a path like "/api"
export const SERVER_URL = new URL(API_BASE, window.location.href).origin;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
