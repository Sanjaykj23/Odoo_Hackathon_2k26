import { Server } from 'socket.io';

let io = null;

/**
 * Initializes Socket.io on the provided HTTP server.
 * @param {import('http').Server} server - The HTTP server instance
 * @param {object} corsOptions - CORS options configuration
 * @returns {Server} The initialized Socket.io server
 */
export function init(server, corsOptions) {
  if (io) {
    console.warn('Socket.io has already been initialized.');
    return io;
  }

  io = new Server(server, {
    cors: corsOptions || {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Listen for branch isolation alignment event
    socket.on('join_branch', (data) => {
      try {
        const { branch_id, role } = data || {};
        if (!branch_id) {
          console.warn(`[Socket] Client ${socket.id} tried to join without branch_id.`);
          socket.emit('error', { message: 'branch_id is required' });
          return;
        }

        const branchStr = String(branch_id);
        const roleStr = role ? String(role).toLowerCase() : 'waiter'; // fallback to standard waiter

        const allRoom = `branch_${branchStr}_all`;
        const roleRoom = `branch_${branchStr}_${roleStr}`;

        // Join the socket rooms
        socket.join(allRoom);
        socket.join(roleRoom);

        console.log(`[Socket] Client ${socket.id} joined rooms: [${allRoom}], [${roleRoom}]`);

        // Emit acknowledgment event
        socket.emit('joined_branch', {
          branch_id: branchStr,
          role: roleStr,
          rooms: [allRoom, roleRoom]
        });
      } catch (err) {
        console.error(`[Socket] Error handling join_branch for socket ${socket.id}:`, err);
        socket.emit('error', { message: 'Failed to join branch rooms' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id}. Reason: ${reason}`);
    });
  });

  console.log('Socket.io state utility successfully initialized.');
  return io;
}

/**
 * Returns the global Socket.io Server instance.
 * Throws a developer-friendly error if accessed prior to initialization.
 * @returns {Server}
 */
export function getIO() {
  if (!io) {
    throw new Error(
      'Socket.io client request failed: Socket.io has not been initialized. Please invoke init(server, corsOptions) on startup.'
    );
  }
  return io;
}
