const db = require('../config/database');

const getStats = async (req, res) => {
  // This is handled in dashboardRoutes.js directly
  res.status(501).json({ error: 'Not implemented' });
};

module.exports = {
  getStats
};