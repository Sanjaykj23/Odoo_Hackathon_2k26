const pool = require('./db');

async function updateImages() {
  const client = await pool.connect();
  try {
    await client.query(`UPDATE products SET image_url = 'https://images.unsplash.com/photo-1579616235489-cf210b4da67e?w=400&auto=format&fit=crop&q=60' WHERE id = 'd1'`);
    await client.query(`UPDATE products SET image_url = 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&auto=format&fit=crop&q=60' WHERE id = 'c2'`);
    console.log('Images updated successfully');
  } catch (err) {
    console.error('Error updating images:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateImages();
