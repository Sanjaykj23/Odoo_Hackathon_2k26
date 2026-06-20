const { Server } = require('socket.io');

let io;

exports.initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // For development, allow all
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('joinRoom', (room) => {
      socket.join(room);
      console.log(\`Socket \${socket.id} joined room: \${room}\`);
    });

    socket.on('leaveRoom', (room) => {
      socket.leave(room);
      console.log(\`Socket \${socket.id} left room: \${room}\`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Helper methods for emitting specific events
exports.notifyKitchen = (shopId, orderData) => {
  if (io) {
    io.to(\`kitchen_\${shopId}\`).emit('newOrder', orderData);
  }
};

exports.notifyAdminCOD = (shopId, orderData) => {
  if (io) {
    io.to(\`admin_\${shopId}\`).emit('codPaymentRequired', orderData);
  }
};

exports.updateCustomerStatus = (orderId, statusData) => {
  if (io) {
    io.to(\`customer_\${orderId}\`).emit('orderStatusUpdated', statusData);
  }
};
