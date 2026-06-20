const pool = require('./db');
pool.query("SELECT * FROM tables WHERE id = 'tbl-4-3' OR qr_token = 'tbl-4-3'").then(res => {
  console.log(res.rows);
  process.exit(0);
});
