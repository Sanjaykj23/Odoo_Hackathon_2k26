const pool = require('../../db');

// GET /api/shifts/previous-summary (Triggers right after user login)
const getPreviousSummary = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Find the most recent closed session for the user
    const lastSessionRes = await pool.query(
      `SELECT * FROM sessions
       WHERE opened_by_user_id = $1 AND status = 'Closed'
       ORDER BY closing_date DESC LIMIT 1`,
      [userId]
    );

    if (lastSessionRes.rows.length === 0) {
      return res.json({ message: "First shift initialization." });
    }

    const lastSession = lastSessionRes.rows[0];

    // 2. Query historical stats for this session
    const statsRes = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0)::float as total_sales,
        COUNT(*)::int as orders_count
       FROM orders
       WHERE session_id = $1 AND status = 'Paid'`,
      [lastSession.id]
    );

    const stats = statsRes.rows[0];

    res.json({
      sessionId: lastSession.id,
      openedAt: lastSession.opening_date,
      closedAt: lastSession.closing_date,
      totalSales: stats.total_sales,
      ordersCount: stats.orders_count,
      closingSaleAmount: parseFloat(lastSession.closing_sale_amount || 0.00)
    });
  } catch (err) {
    console.error('Error fetching previous shift summary:', err);
    res.status(500).json({ error: 'Database server error fetching previous shift summary.' });
  }
};

// GET /api/shifts/current-summary (Triggers when user initiates checkout/logout workflow)
const getCurrentSummary = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Find the current active open session
    const activeSessionRes = await pool.query(
      `SELECT * FROM sessions
       WHERE opened_by_user_id = $1 AND status = 'Open'
       ORDER BY opening_date DESC LIMIT 1`,
      [userId]
    );

    if (activeSessionRes.rows.length === 0) {
      return res.status(404).json({ error: "No active open session found for the user." });
    }

    const activeSession = activeSessionRes.rows[0];

    // 2. Alert/Check for active tables (Draft or Sent to Kitchen orders)
    const activeOrdersRes = await pool.query(
      `SELECT COUNT(*)::int as active_count
       FROM orders
       WHERE session_id = $1 AND status = 'Draft'`,
      [activeSession.id]
    );

    const activeCount = activeOrdersRes.rows[0].active_count;

    // 3. Payment Method breakdown
    const paymentBreakdownRes = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total_amount ELSE 0 END), 0)::float as cash_revenue,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'upi' THEN total_amount ELSE 0 END), 0)::float as upi_revenue,
        COUNT(*)::int as paid_orders_count
       FROM orders
       WHERE session_id = $1 AND status = 'Paid'`,
      [activeSession.id]
    );

    const breakdown = paymentBreakdownRes.rows[0];

    // Expected register cash: 0.00 opening balance + cash sales
    const expectedDrawerTotal = 0.00 + breakdown.cash_revenue;

    res.json({
      sessionId: activeSession.id,
      openedAt: activeSession.opening_date,
      hasActiveDrafts: activeCount > 0,
      activeDraftsCount: activeCount,
      ordersCount: breakdown.paid_orders_count,
      cashRevenue: breakdown.cash_revenue,
      upiRevenue: breakdown.upi_revenue,
      expectedDrawerTotal
    });
  } catch (err) {
    console.error('Error fetching current shift summary:', err);
    res.status(500).json({ error: 'Database server error fetching current shift summary.' });
  }
};

module.exports = {
  getPreviousSummary,
  getCurrentSummary
};
