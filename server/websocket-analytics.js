const { Server } = require('socket.io');
const { logger } = require('./logger');
const { authenticate: jwtAuthenticate } = require('./auth/auth-middleware');

let io = null;
let analyticsRoom = 'analytics';

/**
 * Initialize Socket.IO server for real-time analytics
 * @param {import('http').Server} httpServer - HTTP server instance
 * @param {string} corsOrigin - CORS origin(s) for Socket.IO
 */
function initializeWebSocket(httpServer, corsOrigin) {
    io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
            credentials: true,
            methods: ['GET', 'POST']
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });

    // Authentication middleware for Socket.IO
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Create a mock request object to use the existing JWT auth middleware
            const mockReq = {
                headers: { authorization: `Bearer ${token}` },
                cookies: {}
            };
            const mockRes = {
                status: () => mockRes,
                json: () => {}
            };

            // Use the existing auth middleware logic
            await new Promise((resolve, reject) => {
                jwtAuthenticate(mockReq, mockRes, (err) => {
                    if (err) return reject(err);
                    socket.user = mockReq.user;
                    resolve();
                });
            });

            next();
        } catch (error) {
            logger.warn(
                { category: 'websocket', eventType: 'ws.auth.fail', error: error.message },
                'WebSocket authentication failed'
            );
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(
            {
                category: 'websocket',
                eventType: 'ws.connect',
                socketId: socket.id,
                userId: socket.user?.id
            },
            'Client connected to WebSocket'
        );

        // Join analytics room for real-time updates
        socket.join(analyticsRoom);

        // Handle custom events
        socket.on('subscribe:analytics', (data) => {
            logger.debug(
                { category: 'websocket', eventType: 'ws.subscribe', data },
                'Client subscribed to analytics updates'
            );
            socket.emit('analytics:subscribed', { success: true });
        });

        socket.on('subscribe:station', (stationId) => {
            const roomName = `station:${stationId}`;
            socket.join(roomName);
            logger.debug(
                { category: 'websocket', eventType: 'ws.subscribe.station', stationId },
                'Client subscribed to station analytics'
            );
            socket.emit('station:subscribed', { stationId, success: true });
        });

        socket.on('unsubscribe:station', (stationId) => {
            const roomName = `station:${stationId}`;
            socket.leave(roomName);
            logger.debug(
                { category: 'websocket', eventType: 'ws.unsubscribe.station', stationId },
                'Client unsubscribed from station analytics'
            );
        });

        socket.on('disconnect', (reason) => {
            logger.info(
                {
                    category: 'websocket',
                    eventType: 'ws.disconnect',
                    socketId: socket.id,
                    reason
                },
                'Client disconnected from WebSocket'
            );
        });

        socket.on('error', (error) => {
            logger.error(
                {
                    err: error,
                    category: 'websocket',
                    eventType: 'ws.error',
                    socketId: socket.id
                },
                'WebSocket error occurred'
            );
        });
    });

    logger.info(
        { category: 'websocket', eventType: 'ws.init' },
        'WebSocket server initialized'
    );

    return io;
}

/**
 * Broadcast analytics event to all connected clients
 * @param {string} eventType - Type of analytics event
 * @param {object} data - Event data to broadcast
 */
function broadcastAnalyticsEvent(eventType, data) {
    if (!io) {
        logger.warn(
            { category: 'websocket', eventType: 'ws.broadcast.fail' },
            'Cannot broadcast - WebSocket not initialized'
        );
        return;
    }

    const payload = {
        type: eventType,
        data,
        timestamp: new Date().toISOString()
    };

    io.to(analyticsRoom).emit('analytics:update', payload);

    logger.debug(
        { category: 'websocket', eventType: 'ws.broadcast', type: eventType },
        'Broadcast analytics event'
    );
}

/**
 * Broadcast station-specific analytics event
 * @param {number|string} stationId - Station ID
 * @param {string} eventType - Type of analytics event
 * @param {object} data - Event data to broadcast
 */
function broadcastStationEvent(stationId, eventType, data) {
    if (!io) {
        logger.warn(
            { category: 'websocket', eventType: 'ws.broadcast.fail' },
            'Cannot broadcast - WebSocket not initialized'
        );
        return;
    }

    const roomName = `station:${stationId}`;
    const payload = {
        type: eventType,
        stationId,
        data,
        timestamp: new Date().toISOString()
    };

    io.to(roomName).emit('station:update', payload);

    logger.debug(
        { category: 'websocket', eventType: 'ws.broadcast.station', stationId, type: eventType },
        'Broadcast station analytics event'
    );
}

/**
 * Broadcast dashboard statistics update
 * @param {object} stats - Dashboard statistics
 */
function broadcastDashboardUpdate(stats) {
    broadcastAnalyticsEvent('dashboard:update', stats);
}

/**
 * Broadcast listening event
 * @param {object} event - Listening event data
 */
function broadcastListeningEvent(event) {
    broadcastAnalyticsEvent('listening:event', event);

    // Also broadcast to station-specific room if stationId exists
    if (event.station_id) {
        broadcastStationEvent(event.station_id, 'listening:event', event);
    }
}

/**
 * Broadcast trending stats update
 * @param {object} trends - Trending statistics
 */
function broadcastTrendingUpdate(trends) {
    broadcastAnalyticsEvent('trending:update', trends);
}

/**
 * Broadcast geographic distribution update
 * @param {object} geo - Geographic distribution data
 */
function broadcastGeographicUpdate(geo) {
    broadcastAnalyticsEvent('geographic:update', geo);
}

/**
 * Get connected clients count
 * @returns {number} Number of connected clients
 */
function getConnectedClientsCount() {
    if (!io) return 0;
    return io.engine.clientsCount;
}

module.exports = {
    initializeWebSocket,
    broadcastAnalyticsEvent,
    broadcastStationEvent,
    broadcastDashboardUpdate,
    broadcastListeningEvent,
    broadcastTrendingUpdate,
    broadcastGeographicUpdate,
    getConnectedClientsCount
};
