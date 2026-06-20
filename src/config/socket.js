const { Server } = require('socket.io');

let io = null;

<<<<<<< HEAD
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
=======
const socketUtil = {
  init: (httpServer, corsOptions) => {
    io = new Server(httpServer, {
      cors: corsOptions
    });

    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Multi-tenant Room Registration
      socket.on('join_branch', ({ branch_id, role }) => {
        if (!branch_id) return;

        const parsedBranchId = branch_id.toString();
        
        // 1. Every terminal joins the broad branch room
        socket.join(`branch_${parsedBranchId}_all`);
        
        // 2. Terminals join a role-specific room (e.g., kitchen, pos, customer)
        if (role) {
          socket.join(`branch_${parsedBranchId}_${role}`);
          console.log(`🎯 Socket ${socket.id} joined: branch_${parsedBranchId}_${role}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("❌ Socket.io has not been initialized! Call init first.");
    }
    return io;
  }
};

module.exports = socketUtil;
>>>>>>> ff227929a91111fd3e83001011bb6efa4634d10e
