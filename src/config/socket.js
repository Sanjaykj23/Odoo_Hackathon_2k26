const { Server } = require('socket.io');

let io = null;

const socketUtil = {
  init: (httpServer, corsOptions) => {
    io = new Server(httpServer, {
      cors: corsOptions || {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      }
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

      // Legacy support for shop_id
      socket.on('join_shop', (data) => {
        const shopId = data?.shop_id;
        if (shopId) {
          const roomName = `shop_${shopId}`;
          socket.join(roomName);
          console.log(`[Socket] Socket ${socket.id} joined room ${roomName}`);
        } else {
          socket.join('global_admin');
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
  },

  broadcast: (shopId, event, payload) => {
    if (!io) return;
    const message = { type: event, payload };
    if (shopId) {
      const roomName = `shop_${shopId}`;
      io.to(roomName).to('global_admin').emit('message', message);
    } else {
      io.emit('message', message);
    }
  },

  notifyKitchen: (shopId, orderData) => {
    if (!io) return;
    io.to(`shop_${shopId}`).to('global_admin').emit('message', { type: 'KITCHEN_NEW_ORDER', payload: orderData });
    io.to(`kitchen_${shopId}`).emit('newOrder', orderData); 
  },
  
  notifyAdminCOD: (shopId, orderData) => {
    if (!io) return;
    io.to(`shop_${shopId}`).to('global_admin').emit('message', { type: 'ADMIN_COD_REQUIRED', payload: orderData });
    io.to(`admin_${shopId}`).emit('codPaymentRequired', orderData);
  },
  
  updateCustomerStatus: (orderId, statusData) => {
    if (!io) return;
    io.to(`customer_${orderId}`).emit('orderStatusUpdated', statusData);
  }
};

module.exports = socketUtil;
