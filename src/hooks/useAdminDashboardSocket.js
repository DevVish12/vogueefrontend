import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../constants/socketEvents';

const getBackendOrigin = (apiBase) => {
  const base = String(apiBase || 'http://localhost:5000/api');
  return base.replace(/\/api\/?$/i, '');
};

export default function useAdminDashboardSocket({ apiBase, onRefresh, enabled = true }) {
  const [connected, setConnected] = useState(false);
  const refreshRef = useRef(onRefresh);
  const timerRef = useRef(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    const backendOrigin = getBackendOrigin(apiBase);
    const socket = io(backendOrigin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: true,
    });

    const token = localStorage.getItem('adminToken');
    const register = () => {
      if (token) {
        socket.emit('registerAdminDashboard', { token });
      }
    };

    const scheduleRefresh = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        refreshRef.current?.();
      }, 180);
    };

    const liveEvents = [
      'bookingCreated',
      'newBookingRequest',
      'bookingStatusUpdate',
      'partner:kyc_submitted',
      'partner:kyc_updated',
      SOCKET_EVENTS.PAYOUT_UPDATED,
      SOCKET_EVENTS.PAYOUT_HISTORY_UPDATED,
      SOCKET_EVENTS.ADMIN_ANALYTICS_UPDATED,
    ];

    socket.on('connect', () => {
      setConnected(true);
      register();
      scheduleRefresh();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    for (const eventName of liveEvents) {
      socket.on(eventName, scheduleRefresh);
    }

    register();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      for (const eventName of liveEvents) {
        socket.off(eventName, scheduleRefresh);
      }

      socket.disconnect();
    };
  }, [apiBase, enabled]);

  return { connected };
}