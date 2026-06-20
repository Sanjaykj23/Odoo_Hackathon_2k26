const pool = require('../../db');

const getReports = async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    const filterVal = shopId ? parseInt(shopId) : null;

    // 1. Sales Trends (Daily Revenue for Paid Orders)
    const salesTrendsQuery = `
      SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders_count 
      FROM orders 
      WHERE ($1::INT IS NULL OR shop_id = $1) AND status = 'Paid'
      GROUP BY DATE(created_at) 
      ORDER BY DATE(created_at) DESC 
      LIMIT 30
    `;
    const salesTrendsRes = await pool.query(salesTrendsQuery, [filterVal]);

    // 2. Top Products
    const topProductsQuery = `
      SELECT p.id, p.name, SUM(oi.quantity)::INT as quantity, SUM(oi.line_total)::DECIMAL as revenue 
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE ($1::INT IS NULL OR o.shop_id = $1) AND o.status = 'Paid'
      GROUP BY p.id, p.name 
      ORDER BY quantity DESC 
      LIMIT 10
    `;
    const topProductsRes = await pool.query(topProductsQuery, [filterVal]);

    // 3. Top Categories
    const topCategoriesQuery = `
      SELECT c.id, c.name, SUM(oi.quantity)::INT as quantity, SUM(oi.line_total)::DECIMAL as revenue 
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE ($1::INT IS NULL OR o.shop_id = $1) AND o.status = 'Paid'
      GROUP BY c.id, c.name 
      ORDER BY revenue DESC
    `;
    const topCategoriesRes = await pool.query(topCategoriesQuery, [filterVal]);

    // 4. Employee Performance
    const employeePerformanceQuery = `
      SELECT u.id, u.name, COUNT(o.id)::INT as orders_count, SUM(o.total_amount)::DECIMAL as revenue 
      FROM orders o
      JOIN users u ON o.employee_id = u.id
      WHERE ($1::INT IS NULL OR o.shop_id = $1) AND o.status = 'Paid'
      GROUP BY u.id, u.name 
      ORDER BY revenue DESC
    `;
    const employeePerformanceRes = await pool.query(employeePerformanceQuery, [filterVal]);

    // 5. Session Reports
    const sessionReportsQuery = `
      SELECT s.id, s.opening_date, s.closing_date, s.closing_sale_amount::DECIMAL, s.status, u.name as employee_name 
      FROM sessions s
      LEFT JOIN users u ON s.opened_by_user_id = u.id
      WHERE ($1::INT IS NULL OR s.shop_id = $1)
      ORDER BY s.opening_date DESC 
      LIMIT 20
    `;
    const sessionReportsRes = await pool.query(sessionReportsQuery, [filterVal]);

    res.json({
      salesTrends: salesTrendsRes.rows,
      topProducts: topProductsRes.rows,
      topCategories: topCategoriesRes.rows,
      employeePerformance: employeePerformanceRes.rows,
      sessionReports: sessionReportsRes.rows
    });
  } catch (err) {
    console.error('Error generating reports:', err);
    res.status(500).json({ error: 'Database server error calculating reports.' });
  }
};

module.exports = {
  getReports
};
