const twilio = require('twilio');

// Sandbox credentials for Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox number

let twilioClient;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

exports.sendWhatsAppTicket = async (customerPhone, orderData) => {
  if (!twilioClient) {
    console.warn('Twilio credentials not configured. Skipping WhatsApp ticket generation.');
    return;
  }

  // Ensure phone has country code. For India sandbox, you usually use +91...
  let toPhone = customerPhone;
  if (!toPhone.startsWith('+')) {
    toPhone = \`+91\${toPhone}\`; // Defaulting to +91 for this Hackathon, change as needed
  }

  const messageBody = \`
🍔 *Odoo Cafe - Order Confirmed!* 🍔
------------------------------------
*Order #:* \${orderData.order_number}
*Table #:* \${orderData.table_number || 'N/A'}
*Status:* Paid
*Total Amount:* ₹\${orderData.total_amount}

Your food is being prepared. We will notify you once it's ready!
Enjoy your meal at \${orderData.shop_name}!
------------------------------------
\`;

  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: fromWhatsAppNumber,
      to: \`whatsapp:\${toPhone}\`
    });
    console.log(\`WhatsApp ticket sent to \${toPhone}. SID: \${message.sid}\`);
    return message.sid;
  } catch (err) {
    console.error('Error sending WhatsApp ticket:', err);
    throw err;
  }
};
