import { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log(' Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(' Socket disconnected:', reason);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });


    newSocket.on('user-online', ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });


    newSocket.on('notification', ({ notification }) => {
      setNotifications(prev => [notification, ...prev]);
      toast(notification.message, {
        icon: getNotificationIcon(notification.type),
        duration: 4000,
      });
    });

    newSocket.on('message-notification', ({ chatId, sender, preview }) => {
      toast(`${sender.displayName}: ${preview}`, {
        icon: '',
        duration: 5000,
      });
    });

    newSocket.on('new-follower', ({ user: follower }) => {
      toast(`${follower.displayName} started following you!`, { icon: '' });
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const getNotificationIcon = (type) => {
    const icons = { like: '', comment: '', follow: '', mention: '@', share: '', new_message: '' };
    return icons[type] || '';
  };

  const joinChat = (chatId) => socket?.emit('join-chat', chatId);
  const leaveChat = (chatId) => socket?.emit('leave-chat', chatId);

  const sendMessage = (data) => socket?.emit('send-message', data);

  const sendTyping = (chatId, isTyping) => {
    socket?.emit('typing', { chatId, isTyping });
  };

  const isUserOnline = (userId) => onlineUsers.has(userId);

  const clearNotifications = () => setNotifications([]);

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      notifications,
      joinChat,
      leaveChat,
      sendMessage,
      sendTyping,
      isUserOnline,
      clearNotifications,
      markNotificationRead,
      isConnected: socket?.connected || false,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

export default SocketContext;
