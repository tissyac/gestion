const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');

router.use(verifyToken, requireAdmin);
router.get('/overview', adminController.getOverview);

module.exports = router;