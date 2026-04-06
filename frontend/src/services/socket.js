import { io } from "socket.io-client";

let socket = null;
let activeToken = "";

export function getAuctionSocket(token) {
  if (!socket || activeToken !== token) {
    if (socket) socket.disconnect();
    activeToken = token;
    socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token }
    });
  }
  return socket;
}
