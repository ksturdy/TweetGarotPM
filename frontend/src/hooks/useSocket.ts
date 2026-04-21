import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export function useSocket(): Socket | null {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    try {
      const s = connectSocket();
      socketRef.current = s;
    } catch (err) {
      console.error('[useSocket] Failed to connect:', err);
    }
  }, [user]);

  return socketRef.current || getSocket();
}
