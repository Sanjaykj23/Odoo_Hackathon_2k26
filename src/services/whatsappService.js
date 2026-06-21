const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
const pool = require('../../db');

// Initialize Twilio Client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let client = null;

if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
  } catch (err) {
    console.error('[Twilio] Failed to initialize Twilio client:', err);
  }
}

const QRCode = require('qrcode');

/**
 * Generates an SVG ticket containing order details and returns the SVG string.
 */
async function generateSVGTicket(order, items, shop, table) {
  const itemsRows = items.map((item, idx) => {
    const yPos = 180 + idx * 25;
    return `
      <text x="25" y="${yPos}" font-family="Arial, sans-serif" font-size="12" fill="#334155">${item.product_name || 'Item'}</text>
      <text x="170" y="${yPos}" font-family="Arial, sans-serif" font-size="12" fill="#334155" text-anchor="middle">x${item.quantity}</text>
      <text x="275" y="${yPos}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="end">₹${parseFloat(item.line_total).toFixed(2)}</text>
    `;
  }).join('');

  const contentHeight = 220 + items.length * 25;
  const barcodeY = contentHeight + 10;
  const totalY = contentHeight + 60;
  const qrSize = 100;
  const svgHeight = totalY + qrSize + 40;

  const rawQrSvg = await QRCode.toString(order.order_number, {
    type: 'svg',
    margin: 0,
    color: { dark: '#1e293b', light: '#ffffff' }
  });
  
  // Mobile SVG viewers often drop nested <svg> tags for security.
  // Extract viewBox to calculate scale
  const viewBoxMatch = rawQrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const qrNativeSize = viewBoxMatch ? parseInt(viewBoxMatch[1]) : 25;
  const scale = qrSize / qrNativeSize;
  
  // Extract inner paths
  const innerPaths = rawQrSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
  
  // Embed using a `<g>` transform group which is universally supported
  const qrSvgEmbedded = `<g transform="translate(100, ${totalY}) scale(${scale})">${innerPaths}</g>`;

  return `
    <svg width="300" height="${svgHeight}" viewBox="0 0 300 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Card -->
      <rect width="300" height="${svgHeight}" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <!-- Metro Ticket Header (Purple Theme) -->
      <path d="M 0 16 A 16 16 0 0 1 16 0 L 284 0 A 16 16 0 0 1 300 16 L 300 90 L 0 90 Z" fill="#714B67"/>
      
      <!-- Ticket Details -->
      <text x="150" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="black" fill="#ffffff" text-anchor="middle">ODOO CAFE METRO-TICKET</text>
      <text x="150" y="55" font-family="Arial, sans-serif" font-size="11" fill="#f5f3f4" text-anchor="middle">${shop?.name || 'Odoo Cafe'}</text>
      <text x="150" y="72" font-family="Arial, sans-serif" font-size="10" fill="#e5e5e5" text-anchor="middle">${shop?.address || ''}</text>
      
      <!-- Ticket Details Grid -->
      <text x="25" y="120" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#94a3b8">ORDER NO</text>
      <text x="25" y="138" font-family="Arial, sans-serif" font-size="13" font-weight="black" fill="#1e293b">${order.order_number}</text>
      
      <text x="150" y="120" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#94a3b8" text-anchor="middle">TABLE NO</text>
      <text x="150" y="138" font-family="Arial, sans-serif" font-size="14" font-weight="black" fill="#714B67" text-anchor="middle">#${table?.table_number || 'N/A'}</text>
      
      <text x="275" y="120" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#94a3b8" text-anchor="end">DATE</text>
      <text x="275" y="138" font-family="Arial, sans-serif" font-size="11" fill="#475569" text-anchor="end">${new Date(order.created_at).toLocaleDateString()}</text>
      
      <!-- Divider -->
      <line x1="20" y1="155" x2="280" y2="155" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4 4"/>
      
      <!-- Items Section -->
      ${itemsRows}
      
      <!-- Divider -->
      <line x1="20" y1="${barcodeY - 5}" x2="280" y2="${barcodeY - 5}" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4 4"/>
      
      <!-- Total Price Bar -->
      <rect x="20" y="${barcodeY + 10}" width="260" height="40" rx="8" fill="#f8fafc"/>
      <text x="35" y="${barcodeY + 34}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#64748b">AMOUNT PAID</text>
      <text x="265" y="${barcodeY + 35}" font-family="Arial, sans-serif" font-size="16" font-weight="black" fill="#714B67" text-anchor="end">₹${parseFloat(order.total_amount).toFixed(2)}</text>
      
      <!-- Actual Scannable QR Code -->
      ${qrSvgEmbedded}
      
      <text x="150" y="${totalY + qrSize + 20}" font-family="Arial, sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">SCAN FOR ENTRY / EXIT VALIDATION</text>
    </svg>
  `;
}

/**
 * Main Service to process order details, write the SVG ticket image to public dir,
 * and send a WhatsApp confirmation message via Twilio.
 */
async function sendOrderConfirmation(orderId) {
  console.log(`[WhatsApp] Generating ticket for order ${orderId}...`);

  try {
    // 1. Fetch Order details
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      throw new Error(`Order ${orderId} not found.`);
    }
    const order = orderRes.rows[0];

    // 2. Fetch Shop details
    const shopRes = await pool.query('SELECT * FROM shops WHERE id = $1', [order.shop_id]);
    const shop = shopRes.rows[0];

    // 3. Fetch Table details
    let table = null;
    if (order.table_id) {
      const tableRes = await pool.query('SELECT * FROM tables WHERE id = $1', [order.table_id]);
      table = tableRes.rows[0];
    }

    // 4. Fetch Order Items details
    const itemsRes = await pool.query(
      `SELECT oi.*, p.name as product_name 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows;

    // 5. Generate SVG content
    const svgContent = await generateSVGTicket(order, items, shop, table);

    // 6. Ensure the public tickets directory exists
    const publicDir = path.join(__dirname, '../../public');
    const ticketsDir = path.join(publicDir, 'tickets');
    
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
    if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir);

    const ticketFileName = `ticket-${orderId}.svg`;
    const ticketFilePath = path.join(ticketsDir, ticketFileName);
    fs.writeFileSync(ticketFilePath, svgContent, 'utf8');
    console.log(`[WhatsApp] Ticket SVG saved to ${ticketFilePath}`);

    // Expose ticket URL (we'll store it in the database orders.ticket_url column)
    const host = process.env.PUBLIC_URL || `https://app.odoocafe.com`;
    const ticketUrl = `${host}/public/tickets/${ticketFileName}`;
    await pool.query('UPDATE orders SET ticket_url = $1 WHERE id = $2', [ticketUrl, orderId]);

    // 7. Get Customer details / phone number
    let phoneNum = null;
    if (order.customer_id) {
      const custRes = await pool.query('SELECT phone_number FROM customers WHERE id = $1', [order.customer_id]);
      phoneNum = custRes.rows[0]?.phone_number;
    }
    
    // Format phone number to E.164 standard required by Twilio
    if (phoneNum) {
      phoneNum = phoneNum.trim();
      if (!phoneNum.startsWith('+')) {
        const digitsOnly = phoneNum.replace(/\D/g, '');
        // Default to +91 (India) if exactly 10 digits are provided without country code
        if (digitsOnly.length === 10) {
          phoneNum = '+91' + digitsOnly;
        } else {
          phoneNum = '+' + digitsOnly;
        }
      }
    }

    // Fallback to searching order notes or a default number if no phone number was captured
    if (!phoneNum) {
      phoneNum = '+919999999999'; // Default Sandbox test recipient fallback
    }

    // Format phone number for Twilio whatsapp (must start with whatsapp:)
    const recipient = phoneNum.startsWith('whatsapp:') ? phoneNum : `whatsapp:${phoneNum}`;
    const twilioSandboxNumber = 'whatsapp:+14155238886'; // Standard Sandbox number

    const messageBody = `*Odoo Cafe - Order Confirmed!* \n\nHello! Your order has been received for Table #${table?.table_number || 'N/A'}.\n\n*Ticket Number:* ${order.order_number}\n*Total Amount:* ₹${parseFloat(order.total_amount).toFixed(2)}\n\nYou can view and download your digital Metro-Ticket here:\n${ticketUrl}\n\nThank you for dining with us!`;

    // 8. Send WhatsApp Message
    if (client) {
      console.log(`[WhatsApp] Sending Twilio WhatsApp to ${recipient}...`);
      
      const isLocalhost = host.includes('localhost');
      let messageOptions = {
        body: messageBody,
        from: twilioSandboxNumber,
        to: recipient
      };
      
      if (!isLocalhost) {
        messageOptions.mediaUrl = [ticketUrl];
      } else {
        console.log('[WhatsApp] Skipping mediaUrl because host is localhost (Twilio cannot access localhost images). Ticket link is still in the body text.');
      }

      try {
        const twilioRes = await client.messages.create(messageOptions);
        console.log(`[WhatsApp] Twilio message sent successfully to ${recipient}. SID: ${twilioRes.sid}`);
      } catch (twilioErr) {
        console.error(`[WhatsApp] Twilio API Error: ${twilioErr.message}`);
        console.log(`\n*** IMPORTANT ***\nIf you are using Twilio Sandbox, you MUST send a WhatsApp message to ${twilioSandboxNumber} with the phrase "join <your-sandbox-word>" from the number ${recipient} before it can receive messages.\n`);
      }
    } else {
      console.log(`================================================================`);
      console.log(`[WhatsApp MOCK LOG] Twilio Credentials not active.`);
      console.log(`To: ${recipient}`);
      console.log(`From: ${twilioSandboxNumber}`);
      console.log(`Message Body:`);
      console.log(messageBody);
      console.log(`Media URL: ${ticketUrl}`);
      console.log(`================================================================`);
    }

  } catch (err) {
    console.error('[WhatsApp] Failed to process order confirmation:', err);
    throw err;
  }
}

module.exports = {
  sendOrderConfirmation
};
