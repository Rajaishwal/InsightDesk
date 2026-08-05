// socket.js — Shared Socket.io instance so controllers can emit real-time events
let _io = null;

export const setIo = (io) => { _io = io; };
export const getIo = () => _io;