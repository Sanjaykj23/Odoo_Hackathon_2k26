const puppeteer = require('puppeteer');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');

// Ensure public directory exists
const publicDir = path.join(__dirname, '../../public/tickets');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

exports.generateTicketImage = async (orderData) => {
  const { order_id, order_number, table_number, shop_name, shop_address, total_amount, date, items } = orderData;
  const fileName = `ticket_${order_id}.png`;
  const filePath = path.join(publicDir, fileName);

  try {
    // Generate barcode as base64
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: order_number || 'UNKNOWN',
      scale: 3,
      height: 10,
      includetext: false,
      textxalign: 'center',
    });
    const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

    // Render items HTML
    let itemsHtml = '';
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #333;">
            <div style="flex: 2;">${item.name || 'Item'}</div>
            <div style="flex: 1; text-align: center;">x${item.quantity || 1}</div>
            <div style="flex: 1; text-align: right; font-weight: bold;">₹${item.price || '0.00'}</div>
          </div>
        `;
      });
    }

    // Determine current date if not provided
    const displayDate = date || new Date().toLocaleDateString('en-IN');

    const htmlContent = `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 0;
              background-color: transparent;
              width: 400px;
            }
            .ticket-container {
              width: 360px;
              margin: 20px auto;
              background: #fff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              border: 1px solid #eaeaea;
            }
            .ticket-header {
              background-color: #6C4A63; /* Odoo Cafe Purpleish */
              color: white;
              text-align: center;
              padding: 20px;
            }
            .ticket-header h2 {
              margin: 0 0 10px 0;
              font-size: 18px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .ticket-header p {
              margin: 2px 0;
              font-size: 12px;
              opacity: 0.9;
            }
            .ticket-body {
              padding: 20px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              text-align: center;
              margin-bottom: 15px;
            }
            .info-col {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 10px;
              color: #888;
              font-weight: 600;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 14px;
              color: #333;
              font-weight: 600;
            }
            .divider {
              border-top: 2px dashed #ddd;
              margin: 15px 0;
            }
            .items-container {
              min-height: 80px;
            }
            .amount-paid {
              background-color: #f8f9fa;
              border-radius: 8px;
              padding: 15px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 15px;
            }
            .amount-label {
              font-size: 14px;
              font-weight: 600;
              color: #4b5563;
            }
            .amount-value {
              font-size: 20px;
              font-weight: 700;
              color: #6C4A63;
            }
            .barcode-container {
              text-align: center;
              padding: 10px 20px 20px;
            }
            .barcode-container img {
              width: 80%;
              height: 40px;
            }
            .barcode-footer {
              font-size: 9px;
              color: #aaa;
              margin-top: 5px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <div class="ticket-header">
              <h2>ODOO CAFE METRO-TICKET</h2>
              <p>${shop_name || 'Odoo Cafe'}</p>
              <p>${shop_address || 'Virtual Hub'}</p>
            </div>
            
            <div class="ticket-body">
              <div class="info-row">
                <div class="info-col" style="align-items: flex-start;">
                  <span class="info-label">ORDER NO</span>
                  <span class="info-value">${order_number || 'N/A'}</span>
                </div>
                <div class="info-col" style="align-items: center;">
                  <span class="info-label">TABLE NO</span>
                  <span class="info-value" style="color: #6C4A63;">#${table_number || 'N/A'}</span>
                </div>
                <div class="info-col" style="align-items: flex-end;">
                  <span class="info-label">DATE</span>
                  <span class="info-value">${displayDate}</span>
                </div>
              </div>

              <div class="divider"></div>

              <div class="items-container">
                ${itemsHtml}
              </div>

              <div class="divider"></div>

              <div class="amount-paid">
                <span class="amount-label">AMOUNT PAID</span>
                <span class="amount-value">₹${total_amount || '0.00'}</span>
              </div>
            </div>

            <div class="barcode-container">
              <img src="${barcodeBase64}" alt="Barcode" />
              <div class="barcode-footer">SCAN FOR ENTRY / EXIT VALIDATION</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Check common paths for Chrome/Edge on Windows
    let executablePath = '';
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }

    // Render with Puppeteer
    const browser = await puppeteer.launch({ 
      headless: 'new',
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 800 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Get dimensions of ticket container
    const element = await page.$('.ticket-container');
    const boundingBox = await element.boundingBox();
    
    // Take screenshot
    await page.screenshot({ 
      path: filePath,
      clip: {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height
      }
    });

    await browser.close();

    console.log(`[ImageGenerator] Created ticket image at ${filePath}`);
    return fileName;
  } catch (err) {
    console.error('Error generating ticket image:', err);
    throw err;
  }
};
