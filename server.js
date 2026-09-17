require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌱 AgriGrowthRate Backend running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/api/health\n`);
});

// Initialize Socket.io
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  },
});

const Conversation = require('./src/models/Conversation');
const User = require('./src/models/User');
const { findById } = require('./src/utils/dbHelpers');
const { v4: uuidv4 } = require('uuid');

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`[Socket] User joined conversation: ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, senderId, text } = data;
      if (!conversationId || !senderId || !text) return;

      const conversation = await findById(Conversation, conversationId);
      if (!conversation) return;

      const senderUser = await findById(User, senderId);
      const newMessage = {
        id: uuidv4(),
        sender: senderId,
        text: text.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedMessages = Array.isArray(conversation.messages)
        ? [...conversation.messages, newMessage]
        : [newMessage];

      await Conversation.update({ id: conversationId }, { messages: updatedMessages });

      const messageToEmit = {
        ...newMessage,
        sender: senderUser ? { id: senderUser.id, name: senderUser.name, avatar: senderUser.avatar } : null,
        conversationId
      };

      // Broadcast to room
      io.to(conversationId).emit('receive_message', messageToEmit);
    } catch (error) {
      console.error('[Socket] Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
