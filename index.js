const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, '../public')));

// --- State ---
const waitingQueue = new Map(); // socketId -> { socket, country, interests }
const activePairs = new Map();  // socketId -> partnerSocketId
const reportedUsers = new Map(); // socketId -> count
const bannedIPs = new Set();
const connectedUsers = new Map(); // socketId -> { ip, country, joinedAt }

function findMatch(socket, prefs) {
  // Try to find a waiting user (not self)
  for (const [id, waiter] of waitingQueue) {
    if (id === socket.id) continue;
    // Country filter: if both specify a country, they must match; else any
    if (prefs.country && waiter.country && prefs.country !== waiter.country) continue;

    waitingQueue.delete(id);
    // Pair them
    activePairs.set(socket.id, id);
    activePairs.set(id, socket.id);

    socket.emit('matched', { role: 'initiator' });
    waiter.socket.emit('matched', { role: 'receiver' });

    io.emit('stats', { online: connectedUsers.size, chatting: activePairs.size / 2, waiting: waitingQueue.size });
    return true;
  }
  return false;
}

function disconnectPair(socketId, reason = 'stranger_left') {
  const partnerId = activePairs.get(socketId);
  if (partnerId) {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('partner_disconnected', { reason });
    }
    activePairs.delete(partnerId);
  }
  activePairs.delete(socketId);
}

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  if (bannedIPs.has(ip)) {
    socket.emit('banned', { reason: 'You have been banned for violating community guidelines.' });
    socket.disconnect(true);
    return;
  }

  connectedUsers.set(socket.id, { ip, country: 'IN', joinedAt: Date.now() });
  io.emit('stats', { online: connectedUsers.size, chatting: activePairs.size / 2, waiting: waitingQueue.size });

  // --- Find a match ---
  socket.on('find_match', ({ country = 'IN', interests = [] } = {}) => {
    // Remove from any existing pair
    disconnectPair(socket.id, 'next');
    waitingQueue.delete(socket.id);

    const prefs = { country, interests };
    const matched = findMatch(socket, prefs);
    if (!matched) {
      waitingQueue.set(socket.id, { socket, ...prefs });
      socket.emit('waiting');
    }
  });

  // --- Chat message ---
  socket.on('message', ({ text }) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('message', { text, from: 'stranger' });
    }
  });

  // --- Typing indicator ---
  socket.on('typing', ({ isTyping }) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('typing', { isTyping });
    }
  });

  // --- WebRTC signaling ---
  socket.on('webrtc_offer', (data) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    io.to(partnerId).emit('webrtc_offer', data);
  });

  socket.on('webrtc_answer', (data) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    io.to(partnerId).emit('webrtc_answer', data);
  });

  socket.on('webrtc_ice', (data) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    io.to(partnerId).emit('webrtc_ice', data);
  });

  socket.on('webrtc_end', () => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;
    io.to(partnerId).emit('webrtc_end');
  });

  // --- Report user ---
  socket.on('report', ({ reason }) => {
    const partnerId = activePairs.get(socket.id);
    if (!partnerId) return;

    const count = (reportedUsers.get(partnerId) || 0) + 1;
    reportedUsers.set(partnerId, count);

    socket.emit('report_ack', { message: 'Report submitted. Thank you.' });

    // Auto-ban after 3 reports
    if (count >= 3) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        const partnerInfo = connectedUsers.get(partnerId);
        if (partnerInfo) bannedIPs.add(partnerInfo.ip);
        partnerSocket.emit('banned', { reason: 'You have been banned for multiple violations.' });
        disconnectPair(partnerId, 'banned');
        partnerSocket.disconnect(true);
      }
    }
  });

  // --- Next / Stop ---
  socket.on('next', () => {
    disconnectPair(socket.id, 'next');
    waitingQueue.delete(socket.id);
    const matched = findMatch(socket, connectedUsers.get(socket.id) || {});
    if (!matched) {
      waitingQueue.set(socket.id, { socket, country: 'IN' });
      socket.emit('waiting');
    }
  });

  socket.on('stop', () => {
    disconnectPair(socket.id, 'stopped');
    waitingQueue.delete(socket.id);
    socket.emit('stopped');
    io.emit('stats', { online: connectedUsers.size, chatting: activePairs.size / 2, waiting: waitingQueue.size });
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    disconnectPair(socket.id);
    waitingQueue.delete(socket.id);
    connectedUsers.delete(socket.id);
    io.emit('stats', { online: connectedUsers.size, chatting: activePairs.size / 2, waiting: waitingQueue.size });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🇮🇳 Indian Omegle running at http://localhost:${PORT}`);
});
