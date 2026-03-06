const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Chat, Message } = require('../models/Chat');
const Notification = require('../models/Notification');

let io;
const onlineUsers = new Map();

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });


  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username displayName avatar');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(` User connected: ${socket.user.username} (${socket.id})`);


    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);


    socket.join(`user-${userId}`);


    User.findById(userId).select('followers').then(user => {
      if (user?.followers) {
        user.followers.forEach(followerId => {
          io.to(`user-${followerId}`).emit('user-online', { userId, isOnline: true });
        });
      }
    });


    User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(console.error);



    socket.on('join-chat', async (chatId) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });
        if (chat) {
          socket.join(`chat-${chatId}`);
          socket.emit('joined-chat', { chatId });
        }
      } catch (error) {
        socket.emit('error', { message: 'Could not join chat' });
      }
    });

    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat-${chatId}`);
    });

    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', replyTo, media } = data;

        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        const message = await Message.create({
          sender: userId,
          content,
          messageType,
          replyTo,
          media,
          readBy: [userId],
        });

        await Message.populate(message, { path: 'sender', select: 'username displayName avatar' });


        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: message._id,
          lastActivity: new Date(),
        });


        io.to(`chat-${chatId}`).emit('new-message', {
          chatId,
          message,
        });


        const offlineParticipants = chat.participants.filter(
          p => p.toString() !== userId && !onlineUsers.has(p.toString())
        );

        for (const participantId of offlineParticipants) {
          await Notification.create({
            recipient: participantId,
            sender: userId,
            type: 'new_message',
            chat: chatId,
            message: `${socket.user.displayName}: ${content?.substring(0, 50) || '[Media]'}`,
          });
        }


        for (const participantId of chat.participants) {
          const pid = participantId.toString();
          if (pid !== userId) {
            io.to(`user-${pid}`).emit('message-notification', {
              chatId,
              sender: { _id: userId, displayName: socket.user.displayName, avatar: socket.user.avatar },
              preview: content?.substring(0, 50) || '[Media]',
            });
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(`chat-${chatId}`).emit('user-typing', {
        userId,
        user: { username: socket.user.username, displayName: socket.user.displayName },
        isTyping,
        chatId,
      });
    });

    socket.on('mark-read', async (data) => {
      try {
        const { chatId } = data;
        await Message.updateMany(
          { _id: { $in: [] }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        socket.to(`chat-${chatId}`).emit('messages-read', { chatId, userId });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });



    socket.on('follow-user', async (targetUserId) => {
      io.to(`user-${targetUserId}`).emit('new-follower', {
        userId,
        user: { username: socket.user.username, displayName: socket.user.displayName, avatar: socket.user.avatar },
      });
    });



    socket.on('disconnect', () => {
      console.log(` User disconnected: ${socket.user.username} (${socket.id})`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);


          User.findById(userId).select('followers').then(user => {
            if (user?.followers) {
              user.followers.forEach(followerId => {
                io.to(`user-${followerId}`).emit('user-online', { userId, isOnline: false });
              });
            }
          });

          User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(console.error);
        }
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const isUserOnline = (userId) => onlineUsers.has(userId.toString());

const getOnlineUsers = () => [...onlineUsers.keys()];

module.exports = { initializeSocket, getIO, isUserOnline, getOnlineUsers };
