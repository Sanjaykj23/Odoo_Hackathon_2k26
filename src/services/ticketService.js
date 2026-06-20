const twilio = require('twilio');
const imageGenerator = require('./imageGenerator');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox number

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

exports.sendBookingWhatsApp = async (toNumber, bookingDetails, ticketUrl) => {
  if (!client) {
    console.warn('Twilio credentials not configured. Skipping WhatsApp message.');
    return;
  }

  let toPhone = toNumber;
  if (!toPhone.startsWith('+')) {
    toPhone = `+91${toPhone}`;
  }

  try {
    const message = await client.messages.create({
      from: fromWhatsAppNumber,
      to: `whatsapp:${toPhone}`,
      body: `Booking Confirmed!\nTable: ${bookingDetails.table || 'N/A'}\nSeats: ${bookingDetails.groupSize || 'N/A'}\nTime: ${bookingDetails.time || new Date().toLocaleTimeString()}`,
      mediaUrl: ticketUrl ? [ticketUrl] : []
    });
    console.log("Message sent:", message.sid);
    return message.sid;
  } catch (err) {
    console.error("Error sending WhatsApp:", err);
  }
};

exports.sendThankYouWhatsApp = async (toNumber, shopName) => {
  if (!client) return;

  let toPhone = toNumber;
  if (!toPhone.startsWith('+')) {
    toPhone = `+91${toPhone}`;
  }

  try {
    const message = await client.messages.create({
      from: fromWhatsAppNumber,
      to: `whatsapp:${toPhone}`,
      body: `Thank you for visiting ${shopName || 'Odoo Cafe'}! We hope you enjoyed your meal. Have a wonderful day!`
    });
    console.log("Thank you message sent:", message.sid);
  } catch (err) {
    console.error("Error sending Thank You WhatsApp:", err);
  }
};

exports.generateAndSendTicket = async (orderData) => {
  try {
    // 1. Generate Image
    const fileName = await imageGenerator.generateTicketImage(orderData);
    
    // 2. Construct public URL
    // Require PUBLIC_URL to be set in .env using ngrok
    const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const ticketUrl = `${publicUrl}/public/tickets/${fileName}`;

    // 3. Send WhatsApp
    if (orderData.phone_number) {
      const bookingDetails = {
        table: orderData.table_number,
        total_amount: orderData.total_amount,
        shop_name: orderData.shop_name
      };
      await exports.sendBookingWhatsApp(orderData.phone_number, bookingDetails, ticketUrl);
    }
  } catch (err) {
    console.error('Error in generateAndSendTicket:', err);
  }
};
