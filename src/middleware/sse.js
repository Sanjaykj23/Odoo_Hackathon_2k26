let clients = [];

const register = (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Write a connection confirmation event
  res.write('data: {"type": "CONNECTED", "message": "Real-time SSE channel active"}\n\n');

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };

  clients.push(newClient);
  console.log(`[SSE] Client registered: ${clientId}. Total clients: ${clients.length}`);

  // Keep-alive heartbeat to prevent timeouts
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  // Connection close handler
  req.on('close', () => {
    clearInterval(heartbeat);
    clients = clients.filter(c => c.id !== clientId);
    console.log(`[SSE] Client disconnected: ${clientId}. Total clients: ${clients.length}`);
  });
};

// Broadcast function to notify all clients
const broadcast = (type, payload) => {
  const message = JSON.stringify({ type, payload });
  console.log(`[SSE] Broadcasting ${type} event to ${clients.length} clients.`);
  
  clients.forEach(client => {
    try {
      client.res.write(`data: ${message}\n\n`);
    } catch (err) {
      console.error(`[SSE] Failed to write to client ${client.id}:`, err);
    }
  });
};

module.exports = {
  register,
  broadcast
};
