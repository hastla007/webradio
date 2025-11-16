import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AnalyticsEvent {
    type: string;
    data: any;
    timestamp: string;
}

interface StationEvent {
    type: string;
    stationId: number | string;
    data: any;
    timestamp: string;
}

interface UseAnalyticsWebSocketOptions {
    autoConnect?: boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
    onAnalyticsUpdate?: (event: AnalyticsEvent) => void;
    onStationUpdate?: (event: StationEvent) => void;
}

export function useAnalyticsWebSocket(options: UseAnalyticsWebSocketOptions = {}) {
    const {
        autoConnect = true,
        onConnect,
        onDisconnect,
        onError,
        onAnalyticsUpdate,
        onStationUpdate
    } = options;

    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const getToken = useCallback(() => {
        // Get token from localStorage (where it's stored after login)
        return localStorage.getItem('token');
    }, []);

    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            console.log('WebSocket already connected');
            return;
        }

        const token = getToken();
        if (!token) {
            console.warn('No auth token available for WebSocket connection');
            return;
        }

        setIsConnecting(true);

        // Connect to the WebSocket server
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const socket = io(API_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setIsConnecting(false);
            onConnect?.();

            // Subscribe to analytics updates
            socket.emit('subscribe:analytics');
        });

        socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            setIsConnected(false);
            setIsConnecting(false);
            onDisconnect?.();
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            setIsConnecting(false);
            onError?.(error);
        });

        socket.on('analytics:update', (event: AnalyticsEvent) => {
            console.log('Analytics update received:', event);
            onAnalyticsUpdate?.(event);
        });

        socket.on('station:update', (event: StationEvent) => {
            console.log('Station update received:', event);
            onStationUpdate?.(event);
        });

        socket.on('analytics:subscribed', (data) => {
            console.log('Subscribed to analytics updates:', data);
        });

        socket.on('station:subscribed', (data) => {
            console.log('Subscribed to station updates:', data);
        });

        socketRef.current = socket;
    }, [getToken, onConnect, onDisconnect, onError, onAnalyticsUpdate, onStationUpdate]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    const subscribeToStation = useCallback((stationId: number | string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('subscribe:station', stationId);
        }
    }, []);

    const unsubscribeFromStation = useCallback((stationId: number | string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('unsubscribe:station', stationId);
        }
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect]); // Intentionally not including connect/disconnect to avoid reconnecting on every render

    return {
        isConnected,
        isConnecting,
        connect,
        disconnect,
        subscribeToStation,
        unsubscribeFromStation
    };
}
