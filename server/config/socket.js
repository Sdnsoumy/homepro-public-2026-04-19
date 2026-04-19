/**
 * Socket.io Configuration and JWT Authentication
 * 
 * Architecture Overview:
 * Socket.io provides real-time, bidirectional communication between Angular frontend and Express backend.
 * 
 * Authentication Flow:
 * 1. Frontend (Angular) logs in → receives JWT token
 * 2. Frontend connects to Socket.io → sends token in handshake.auth
 * 3. Backend Socket middleware validates token → attaches user object to socket
 * 4. If invalid, connection rejected before 'connection' event fires
 * 
 * Room Pattern (Personal Rooms):
 * Each authenticated user automatically joins a room named after their MongoDB _id.
 * Example: User with _id="507f1f77bcf86cd799439011" joins room "507f1f77bcf86cd799439011"
 * 
 * Why Personal Rooms?
 * - Supports multiple tabs/devices of same user seamlessly
 * - Server can emit to specific user without finding their socket instance
 * - Cleaner than broadcasting to all and filtering by role
 * 
 * Usage Examples:
 * - New booking notification: io.to(provider._id).emit('new_booking', {...})
 * - Booking status update: io.to(user._id).emit('booking_accepted', {...})
 * - Auto-reject timeout: io.to(provider._id).emit('booking_expired', {...})
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

/**
 * Initializes Socket.io server attached to HTTP server
 * Must be called AFTER http.createServer(app), not app.listen()
 * 
 * @param {http.Server} server - Raw Node HTTP server instance
 * @returns {socket.io.Server} Socket.io instance
 */
const initSocket = (server) => {
  // Create Socket.io instance with CORS and credentials support
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL, // Allow frontend origin (e.g., http://localhost:4200)
      methods: ['GET', 'POST'],
      credentials: true, // Allow cookie/credential transmission
    },
  });

  /**
   * Authentication Middleware: Runs BEFORE 'connection' event
   * Validates JWT token from client handshake.auth
   * If valid, attaches user to socket. If invalid, rejects connection.
   * 
   * This ensures:
   * - Only authenticated users can connect
   * - socket.user is always available in event handlers
   * - Expired tokens are caught early
   */
  io.use(async (socket, next) => {
    try {
      // Extract token from client's auth object
      // Frontend sends: io(url, { auth: { token: 'jwt...' } })
      const token = socket.handshake?.auth?.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      // Verify JWT signature and decode
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch user from DB
      const user = await User.findById(decoded.id).select('-password');

      // Validate user exists and is active
      // isActive flag allows soft-disabling accounts without deleting them
      if (!user || !user.isActive) {
        return next(new Error('Unauthorized'));
      }

      // Attach user to socket for later use in event handlers
      socket.user = user;
      
      // Call next() to allow connection
      next();
    } catch (error) {
      // Token verification failed (invalid signature, expired, etc.)
      next(new Error('Token invalid or expired'));
    }
  });

  /**
   * Connection Event: Fires after auth middleware approves
   * User is guaranteed to be authenticated at this point
   */
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user._id} (${socket.user.role})`);

    /**
     * Personal Room Pattern: Each user joins room named after their _id
     * This is the core architectural pattern for real-time notifications.
     * 
     * Benefits:
     * - Server can call io.to(userId).emit(...) without finding the socket
     * - Multiple browser tabs/devices of same user all receive the event
     * - Decouples notification logic from socket connection state
     */
    socket.join(socket.user._id.toString());

    /**
     * Disconnect Event: Fires when client closes connection
     * Socket.io handles room cleanup automatically
     */
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user._id}`);
      // No need to explicitly leave the room; Socket.io does this automatically
    });
  });

  return io;
};

/**
 * Retrieves the Socket.io instance for emitting events
 * Called by controllers/utilities when they need to notify clients
 * 
 * Usage:
 * const io = getIO();
 * io.to(userId).emit('event_name', data);
 * 
 * @returns {socket.io.Server} Socket.io instance
 * @throws {Error} If Socket.io not initialized
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }

  return io;
};

module.exports = { initSocket, getIO };
