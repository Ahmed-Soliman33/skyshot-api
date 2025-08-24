const express = require("express");

const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
// const auth = require("../middleware/auth");

// // حماية جميع routes الداشبورد
// router.use(auth);

router.get("/stats", dashboardController.getStats);
router.get("/sales", dashboardController.getSalesData);
router.get("/users/growth", dashboardController.getUserGrowthData);
router.get("/activities", dashboardController.getRecentActivities);

module.exports = router;
