const User = require("../models/User");
const Order = require("../models/Order");
const Service = require("../models/Service");

exports.getStats = async (req, res) => {
  try {
    // إحصائيات عامة
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // نمو العملاء (آخر 30 يوم)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newCustomers = await User.countDocuments({
      role: "customer",
      createdAt: { $gte: thirtyDaysAgo },
    });

    const stats = {
      totalRevenue: totalRevenue[0].total || 0,
      totalOrders,
      totalCustomers,
      totalProjects: await Service.countDocuments(),
      revenueGrowth: 12.5, // احسبها بناءً على البيانات الفعلية
      ordersGrowth: 8.3,
      customersGrowth: (newCustomers / totalCustomers) * 100,
      projectsGrowth: 5.7,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};

exports.getSalesData = async (req, res) => {
  try {
    const { period = "7d" } = req.query;

    // حدد الفترة الزمنية
    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // جمع بيانات المبيعات
    const salesData = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: salesData });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};
