// pageCache.js — Lightweight module-level store that persists data across
// React Router navigations (component unmount → remount).
// Pages initialize their state from here so they render instantly on revisit.
// Cache lives in memory only — cleared on browser refresh, and on logout (AuthContext calls clearCache()).

const _store = {};

export const getCache   = (key)      => _store[key];
export const setCache   = (key, val) => { _store[key] = val; };
// clearCache("key") drops one entry; clearCache() drops everything
export const clearCache = (key) => { if (key === undefined) Object.keys(_store).forEach((k) => delete _store[k]); else delete _store[key]; };