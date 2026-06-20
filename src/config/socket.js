const { Server } = require('socket.io');

let io = null;

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
