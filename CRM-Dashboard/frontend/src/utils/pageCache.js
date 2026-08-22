// pageCache.js — Lightweight module-level store that persists data across
// React Router navigations (component unmount → remount).
// Pages initialize their state from here so they render instantly on revisit.
// Cache lives in memory only — cleared automatically on browser refresh/logout.

const _store = {};

export const getCache   = (key)      => _store[key];
export const setCache   = (key, val) => { _store[key] = val; };
export const clearCache = (key)      => { delete _store[key]; };