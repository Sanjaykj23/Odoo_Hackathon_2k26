require('dotenv').config();
const ticketService = require('./src/services/ticketService');

const mockOrder = {
  order_number: 'TEST-12345',
  table_number: 5,
  shop_name: 'Test Cafe',
  total_amount: 150.00
};

async function testTwilio() {
  try {
    const sid = await ticketService.sendWhatsAppTicket('9342079017', mockOrder);
    console.log('Successfully sent ticket, SID:', sid);
  } catch (err) {
    console.error('Failed to send ticket:', err);
  }
}

testTwilio();
