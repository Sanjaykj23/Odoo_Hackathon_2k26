const pool = require('../../db');

// GET /api/analytics/branch (Restricted: Admin, Employee)
const getBranchAnalytics = async (req, res) => {
  const shopId = req.user.shop_id;
  if (!shopId) {
    return res.status(400).json({ error: 'User is not assigned to a shop.' });
  }

  try {
    // 1. Summary: total_revenue, total_orders_count, average_order_value (AOV)
    const summaryRes = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0)::float as total_revenue,
        COUNT(*)::int as total_orders_count,
        COALESCE(AVG(total_amount), 0)::float as average_order_value
       FROM orders
       WHERE shop_id = $1 AND status = 'Paid'`,
      [shopId]
    );
    const summary = summaryRes.rows[0];

    // 2. Sales trends: Group final_amount totals by day for the past 7 days
    const trendsRes = await pool.query(
      `SELECT 
        DATE_TRUNC('day', created_at)::date::text as date, 
        COALESCE(SUM(total_amount), 0)::float as revenue
       FROM orders
       WHERE shop_id = $1 AND status = 'Paid' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date ASC`,
      [shopId]
    );

    // 3. Top products: Aggregate order_items grouped by product.name, sorting by total quantity sold descending. Limit 5.
    const topProductsRes = await pool.query(
      `SELECT 
        p.name as name, 
        SUM(oi.quantity)::int as quantity_sold,
        COALESCE(SUM(oi.line_total), 0)::float as revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.shop_id = $1 AND o.status = 'Paid'
       GROUP BY p.name
       ORDER BY quantity_sold DESC
       LIMIT 5`,
      [shopId]
    );

    // 4. Employee performance: Group orders by employee_id (waiter), returning the employee's name along with their individual total sales volume.
    const employeeRes = await pool.query(
      `SELECT 
        u.name as name, 
        COALESCE(SUM(o.total_amount), 0)::float as total_sales,
        COUNT(o.id)::int as orders_count
       FROM orders o
       JOIN users u ON o.employee_id = u.id
       WHERE o.shop_id = $1 AND o.status = 'Paid'
       GROUP BY u.name
       ORDER BY total_sales DESC`,
      [shopId]
    );

    // 5. Coupon usage: Group paid records by discount_amount > 0 to show usage counts and total discount value given.
    const couponRes = await pool.query(
      `SELECT 
        'Total Discounts' as coupon_code,
        COUNT(*)::int as usage_count,
        COALESCE(SUM(discount_amount), 0)::float as total_discount
       FROM orders
       WHERE shop_id = $1 AND status = 'Paid' AND discount_amount > 0`,
      [shopId]
    );

    res.json({
      summary,
      sales_trends: trendsRes.rows,
      top_products: topProductsRes.rows,
      employee_performance: employeeRes.rows,
      coupon_usage: couponRes.rows[0] || { coupon_code: 'Total Discounts', usage_count: 0, total_discount: 0 }
    });
  } catch (err) {
    console.error('Error fetching branch analytics:', err);
    res.status(500).json({ error: 'Database server error fetching branch analytics.' });
  }
};

// GET /api/analytics/super (Restricted: SuperAdmin)
const getSuperAnalytics = async (req, res) => {
  try {
    // 1. Branch ranking: global summation of final_amount grouped by branch.name and branch.id, sorted from highest revenue to lowest.
    const rankingRes = await pool.query(
      `SELECT 
        s.id as id,
        s.name as name,
        COALESCE(SUM(o.total_amount), 0)::float as total_revenue,
        COUNT(o.id)::int as orders_count
       FROM orders o
       JOIN shops s ON o.shop_id = s.id
       WHERE o.status = 'Paid'
       GROUP BY s.id, s.name
       ORDER BY total_revenue DESC`
    );

    // 2. Global top products: System-wide menu performance chart metrics tracking unit volumes.
    const topProductsRes = await pool.query(
      `SELECT 
        p.name as name, 
        SUM(oi.quantity)::int as quantity_sold,
        COALESCE(SUM(oi.line_total), 0)::float as revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'Paid'
       GROUP BY p.name
       ORDER BY quantity_sold DESC
       LIMIT 10`
    );

    // 3. System health: Total combined multi-branch revenue numbers, active system session counts, and aggregate system-wide AOV.
    const combinedRevRes = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0)::float as total_revenue,
        COALESCE(AVG(total_amount), 0)::float as aggregate_system_aov
       FROM orders
       WHERE status = 'Paid'`
    );
    const activeSessionsRes = await pool.query(
      `SELECT COUNT(*)::int as active_sessions_count 
       FROM sessions 
       WHERE status = 'Open'`
    );

    res.json({
      branch_ranking: rankingRes.rows,
      global_top_products: topProductsRes.rows,
      system_health: {
        total_combined_revenue: combinedRevRes.rows[0].total_revenue,
        active_system_sessions: activeSessionsRes.rows[0].active_sessions_count,
        aggregate_system_aov: combinedRevRes.rows[0].aggregate_system_aov
      }
    });
  } catch (err) {
    console.error('Error fetching super admin analytics:', err);
    res.status(500).json({ error: 'Database server error fetching super admin analytics.' });
  }
};

module.exports = {
  getBranchAnalytics,
  getSuperAnalytics
};
