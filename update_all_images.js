const pool = require('./db');

const images = {
  'b1': 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&auto=format&fit=crop&q=60', // Coffee
  'b2': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=60', // Chai
  'b3': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=60', // Mango Lassi
  'b4': 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&auto=format&fit=crop&q=60', // Rose Milk
  'm1': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&auto=format&fit=crop&q=60', // Vada (using generic Indian food)
  'm2': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=60', // Dosa
  'm3': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=60', // Roll
  'm4': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60', // Burger
  'd1': 'https://images.unsplash.com/photo-1579616235489-cf210b4da67e?w=400&auto=format&fit=crop&q=60', // Gulab Jamun
  'd2': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60', // Rasmalai
  'c1': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&auto=format&fit=crop&q=60', // Pani Puri
  'c2': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&auto=format&fit=crop&q=60'  // Samosa Chaat
};

async function updateAllImages() {
  const client = await pool.connect();
  try {
    for (const [id, url] of Object.entries(images)) {
      await client.query(`UPDATE products SET image_url = $1 WHERE id = $2`, [url, id]);
    }
    console.log('All product images updated successfully');
  } catch (err) {
    console.error('Error updating images:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateAllImages();
