const imageGenerator = require('./src/services/imageGenerator');

const orderData = {
  order_id: '12345',
  order_number: 'T-670',
  table_number: 4,
  shop_name: 'Odoo Cafe HQ',
  shop_address: '123 Tech Park, Suite 100',
  total_amount: 10.49,
  date: '20/6/2026',
  items: [
    { name: 'Crispy Pani Puri', quantity: 1, price: 6.50 },
    { name: 'Royal Rasmalai (2 Pcs)', quantity: 1, price: 5.99 }
  ]
};

async function run() {
  try {
    const filename = await imageGenerator.generateTicketImage(orderData);
    console.log('Test successful! Image saved as:', filename);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

run();
