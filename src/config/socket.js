const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for the hackathon prototype
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Listen for client joining a specific shop's room
    socket.on('join_shop', (data) => {
      const shopId = data?.shop_id;
      if (shopId) {
        const roomName = `shop_${shopId}`;
        socket.join(roomName);
        console.log(`[Socket] Socket ${socket.id} joined room ${roomName}`);
      } else {
        // SuperAdmins or clients without a specific shop can join a global administration room
        socket.join('global_admin');
        console.log(`[Socket] Socket ${socket.id} joined global_admin room`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

/**
 * Broadcasts an event to a specific shop's room, and also to the global admin room.
 */
function broadcast(shopId, event, payload) {
  if (!io) {
    console.warn('[Socket] Attempted to broadcast before Socket.IO was initialized.');
    return;
  }

  const message = { type: event, payload };
  
  if (shopId) {
    const roomName = `shop_${shopId}`;
    console.log(`[Socket] Broadcasting ${event} to room ${roomName} and global_admin`);
    io.to(roomName).to('global_admin').emit('message', message);
  } else {
    console.log(`[Socket] Broadcasting ${event} globally`);
    io.emit('message', message);
  }
}

module.exports = {
  initSocket,
  getIO,
  broadcast,
  notifyKitchen: (shopId, orderData) => {
    if (!io) return;
    io.to(\`shop_\${shopId}\`).to('global_admin').emit('message', { type: 'KITCHEN_NEW_ORDER', payload: orderData });
    io.to(\`kitchen_\${shopId}\`).emit('newOrder', orderData); // specific room if clients join it
  },
  notifyAdminCOD: (shopId, orderData) => {
    if (!io) return;
    io.to(\`shop_\${shopId}\`).to('global_admin').emit('message', { type: 'ADMIN_COD_REQUIRED', payload: orderData });
    io.to(\`admin_\${shopId}\`).emit('codPaymentRequired', orderData);
  },
  updateCustomerStatus: (orderId, statusData) => {
    if (!io) return;
    io.to(\`customer_\${orderId}\`).emit('orderStatusUpdated', statusData);
  }
};
