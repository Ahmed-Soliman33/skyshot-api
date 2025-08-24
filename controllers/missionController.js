const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Mission = require("../models/Mission");
const User = require("../models/User");
const Revenue = require("../models/Revenue");
const Notification = require("../models/Notification");

// @desc    Create new mission
// @route   POST /api/missions
// @access  Private/Admin/Master
exports.createMission = asyncHandler(async (req, res, next) => {
  const missionData = {
    ...req.body,
    createdBy: req.user._id,
  };

  const mission = await Mission.create(missionData);

  await mission.populate("createdBy", "firstName lastName email");

  // Notify all partners about new mission
  const partners = await User.find({ role: "partner", status: "active" });
  const notifications = partners.map((partner) => ({
    user: partner._id,
    title: "New Mission Available",
    message: `A new ${mission.type} mission "${mission.title}" is available in ${mission.location.city}`,
    type: "system",
    priority: "medium",
    data: {
      missionId: mission._id,
      type: mission.type,
      location: mission.location.city,
      budget: mission.budget,
    },
  }));

  await Notification.createBulkNotifications(notifications);

  res
    .status(201)
    .json(new ApiResponse(201, mission, "Mission created successfully"));
});

// @desc    Get all open missions
// @route   GET /api/missions/open
// @access  Private/Partner
exports.getOpenMissions = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const type = req.query.type;
  const city = req.query.city;
  const minBudget = req.query.minBudget;
  const maxBudget = req.query.maxBudget;

  let filters = { status: "open" };

  if (type) filters.type = type;
  if (city) filters["location.city"] = { $regex: city, $options: "i" };
  if (minBudget) filters["budget.min"] = { $gte: parseInt(minBudget) };
  if (maxBudget) filters["budget.max"] = { $lte: parseInt(maxBudget) };

  const missions = await Mission.find(filters)
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Mission.countDocuments(filters);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        missions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Open missions retrieved successfully"
    )
  );
});

// @desc    Apply for mission
// @route   POST /api/missions/:id/apply
// @access  Private/Partner
exports.applyForMission = asyncHandler(async (req, res, next) => {
  const { proposedBudget, message, portfolio } = req.body;

  if (req.user.role !== "partner") {
    return next(
      new ApiError("Only partners can apply for missions", 403, "not_partner")
    );
  }

  const mission = await Mission.findById(req.params.id);

  if (!mission) {
    return next(new ApiError("Mission not found", 404, "mission_not_found"));
  }

  if (mission.status !== "open") {
    return next(
      new ApiError(
        "Mission is not open for applications",
        400,
        "mission_not_open"
      )
    );
  }

  try {
    await mission.applyForMission(
      req.user._id,
      proposedBudget,
      message,
      portfolio
    );

    // Notify mission creator
    await Notification.createNotification({
      user: mission.createdBy,
      title: "New Mission Application",
      message: `${req.user.firstName} ${req.user.lastName} applied for mission "${mission.title}"`,
      type: "system",
      priority: "medium",
      data: {
        missionId: mission._id,
        partnerId: req.user._id,
        proposedBudget,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, mission, "Application submitted successfully")
      );
  } catch (error) {
    return next(new ApiError(error.message, 400, "application_failed"));
  }
});

// @desc    Get partner missions
// @route   GET /api/missions/my-missions
// @access  Private/Partner
exports.getPartnerMissions = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;

  if (req.user.role !== "partner") {
    return next(
      new ApiError("Only partners can access this endpoint", 403, "not_partner")
    );
  }

  const missions = await Mission.findByPartner(req.user._id, status)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Mission.countDocuments({
    assignedTo: req.user._id,
    ...(status && { status }),
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        missions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Partner missions retrieved successfully"
    )
  );
});

// @desc    Accept mission application
// @route   POST /api/missions/:id/accept/:partnerId
// @access  Private/Admin/Master
exports.acceptApplication = asyncHandler(async (req, res, next) => {
  const mission = await Mission.findById(req.params.id);

  if (!mission) {
    return next(new ApiError("Mission not found", 404, "mission_not_found"));
  }

  if (
    mission.createdBy.toString() !== req.user._id.toString() &&
    !["admin", "master"].includes(req.user.role)
  ) {
    return next(
      new ApiError(
        "Not authorized to accept applications",
        403,
        "not_authorized"
      )
    );
  }

  try {
    await mission.acceptApplication(req.params.partnerId);

    // Notify accepted partner
    await Notification.createNotification({
      user: req.params.partnerId,
      title: "Mission Application Accepted",
      message: `Your application for mission "${mission.title}" has been accepted!`,
      type: "system",
      priority: "high",
      data: {
        missionId: mission._id,
        finalBudget: mission.finalBudget,
      },
    });

    // Notify rejected partners
    const rejectedApplications = mission.applications.filter(
      (app) =>
        app.partner.toString() !== req.params.partnerId.toString() &&
        app.status === "rejected"
    );

    for (const app of rejectedApplications) {
      await Notification.createNotification({
        user: app.partner,
        title: "Mission Application Update",
        message: `Thank you for your interest in mission "${mission.title}". We have selected another partner for this project.`,
        type: "system",
        priority: "low",
        data: {
          missionId: mission._id,
        },
      });
    }

    res
      .status(200)
      .json(new ApiResponse(200, mission, "Application accepted successfully"));
  } catch (error) {
    return next(new ApiError(error.message, 400, "accept_failed"));
  }
});

// @desc    Start mission
// @route   POST /api/missions/:id/start
// @access  Private/Partner
exports.startMission = asyncHandler(async (req, res, next) => {
  const mission = await Mission.findById(req.params.id);

  if (!mission) {
    return next(new ApiError("Mission not found", 404, "mission_not_found"));
  }

  if (mission.assignedTo.toString() !== req.user._id.toString()) {
    return next(
      new ApiError(
        "Not authorized to start this mission",
        403,
        "not_authorized"
      )
    );
  }

  if (mission.status !== "assigned") {
    return next(
      new ApiError("Mission cannot be started", 400, "mission_cannot_start")
    );
  }

  mission.status = "in_progress";
  mission.startedAt = new Date();
  await mission.save();

  // Notify mission creator
  await Notification.createNotification({
    user: mission.createdBy,
    title: "Mission Started",
    message: `Mission "${mission.title}" has been started by the assigned partner`,
    type: "system",
    priority: "medium",
    data: {
      missionId: mission._id,
      partnerId: req.user._id,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, mission, "Mission started successfully"));
});

// @desc    Complete mission
// @route   POST /api/missions/:id/complete
// @access  Private/Partner
exports.completeMission = asyncHandler(async (req, res, next) => {
  const { deliverables, notes } = req.body;

  const mission = await Mission.findById(req.params.id);

  if (!mission) {
    return next(new ApiError("Mission not found", 404, "mission_not_found"));
  }

  if (mission.assignedTo.toString() !== req.user._id.toString()) {
    return next(
      new ApiError(
        "Not authorized to complete this mission",
        403,
        "not_authorized"
      )
    );
  }

  if (mission.status !== "in_progress") {
    return next(
      new ApiError(
        "Mission cannot be completed",
        400,
        "mission_cannot_complete"
      )
    );
  }

  await mission.complete(deliverables);

  if (notes) {
    mission.notes = notes;
    await mission.save();
  }

  // Create revenue record for partner
  const partner = await User.findById(req.user._id);
  await Revenue.createMissionPaymentRevenue(mission, partner);

  // Notify mission creator
  await Notification.createNotification({
    user: mission.createdBy,
    title: "Mission Completed",
    message: `Mission "${mission.title}" has been completed by ${req.user.firstName} ${req.user.lastName}`,
    type: "system",
    priority: "high",
    data: {
      missionId: mission._id,
      partnerId: req.user._id,
      deliverables: deliverables?.length || 0,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, mission, "Mission completed successfully"));
});

// @desc    Get all missions (Admin/Master)
// @route   GET /api/missions/admin/all
// @access  Private/Admin/Master
exports.getAllMissions = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const type = req.query.type;
  const search = req.query.search;

  let query = {};

  if (status) query.status = status;
  if (type) query.type = type;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { "location.city": { $regex: search, $options: "i" } },
    ];
  }

  const missions = await Mission.find(query)
    .populate("createdBy", "firstName lastName email")
    .populate("assignedTo", "firstName lastName email")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Mission.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        missions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Missions retrieved successfully"
    )
  );
});

// @desc    Get single mission
// @route   GET /api/missions/:id
// @access  Private
exports.getMission = asyncHandler(async (req, res, next) => {
  const mission = await Mission.findById(req.params.id)
    .populate("createdBy", "firstName lastName email")
    .populate("assignedTo", "firstName lastName email")
    .populate("applications.partner", "firstName lastName email avatar")
    .populate("deliverables.upload", "title thumbnailUrl");

  if (!mission) {
    return next(new ApiError("Mission not found", 404, "mission_not_found"));
  }

  // Check access permissions
  const canAccess =
    mission.createdBy._id.toString() === req.user._id.toString() ||
    mission.assignedTo?._id.toString() === req.user._id.toString() ||
    mission.applications.some(
      (app) => app.partner._id.toString() === req.user._id.toString()
    ) ||
    ["admin", "master"].includes(req.user.role);

  if (!canAccess) {
    return next(
      new ApiError(
        "Not authorized to access this mission",
        403,
        "not_authorized"
      )
    );
  }

  res
    .status(200)
    .json(new ApiResponse(200, mission, "Mission retrieved successfully"));
});
