const jwt = require('jsonwebtoken');
const config = require('../config');
const Presence = require('../models/Presence');
const DirectMessage = require('../models/DirectMessage');

// In-memory map: userId -> Set<socketId> (one user can have multiple tabs)
const userSockets = new Map();

function setupSocketIO(io) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
                  || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, tenantId } = socket.user;

    // Join tenant room for presence broadcasts
    socket.join(`tenant:${tenantId}`);

    // Track this socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Update presence to online
    try {
      await Presence.upsert(userId, tenantId, 'online');
      io.to(`tenant:${tenantId}`).emit('presence:update', {
        userId, status: 'online'
      });
    } catch (err) {
      console.error('[Socket] Presence update failed:', err.message);
    }

    // --- Send a direct message ---
    socket.on('dm:send', async (data, ack) => {
      try {
        const { conversationId, recipientId, body } = data;
        let convId = conversationId;

        // For 1-on-1: find or create conversation
        if (!convId && recipientId) {
          convId = await DirectMessage.findOrCreateConversation(
            tenantId, userId, recipientId
          );
        }

        if (!convId) {
          if (ack) ack({ ok: false, error: 'No conversation or recipient specified' });
          return;
        }

        // Verify sender is a participant
        const isParticipant = await DirectMessage.isParticipant(convId, userId);
        if (!isParticipant) {
          if (ack) ack({ ok: false, error: 'Not a participant of this conversation' });
          return;
        }

        const message = await DirectMessage.createMessage(convId, userId, body);

        // Add sender info to the emitted message
        message.sender_first_name = socket.user.firstName;
        message.sender_last_name = socket.user.lastName;

        // Emit to all participants
        const participants = await DirectMessage.getParticipants(convId);
        for (const p of participants) {
          const sockets = userSockets.get(p.user_id);
          if (sockets) {
            for (const sid of sockets) {
              io.to(sid).emit('dm:receive', {
                conversationId: convId,
                message,
              });
            }
          }
        }

        if (ack) ack({ ok: true, conversationId: convId, message });
      } catch (err) {
        console.error('[Socket] dm:send error:', err);
        if (ack) ack({ ok: false, error: err.message });
      }
    });

    // --- Mark conversation as read ---
    socket.on('dm:read', async ({ conversationId }) => {
      try {
        await DirectMessage.markRead(conversationId, userId);
      } catch (err) {
        console.error('[Socket] dm:read error:', err.message);
      }
    });

    // --- Typing indicator ---
    socket.on('dm:typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('dm:typing', {
        conversationId, userId, isTyping,
      });
    });

    // --- Join conversation room (for typing indicators) ---
    socket.on('dm:join', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('dm:leave', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // --- Disconnect ---
    socket.on('disconnect', async () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          try {
            await Presence.upsert(userId, tenantId, 'offline');
            io.to(`tenant:${tenantId}`).emit('presence:update', {
              userId, status: 'offline'
            });
          } catch (err) {
            console.error('[Socket] Disconnect presence update failed:', err.message);
          }
        }
      }
    });
  });
}

module.exports = { setupSocketIO };
