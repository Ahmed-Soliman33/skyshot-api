const express = require("express");
const {
  createMission,
  getOpenMissions,
  applyForMission,
  getPartnerMissions,
  acceptApplication,
  startMission,
  completeMission,
  getAllMissions,
  getMission,
} = require("../controllers/missionController");
const {
  createMissionValidator,
  applyForMissionValidator,
  acceptApplicationValidator,
  completeMissionValidator,
  getMissionValidator,
} = require("../utils/validators/missionValidator");
const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Public mission routes (for partners)
router.route("/open")
  .get(getOpenMissions);

router.route("/my-missions")
  .get(allowedTo("partner"), getPartnerMissions);

router.route("/:id")
  .get(getMissionValidator, getMission);

router.route("/:id/apply")
  .post(allowedTo("partner"), applyForMissionValidator, applyForMission);

router.route("/:id/start")
  .post(allowedTo("partner"), startMission);

router.route("/:id/complete")
  .post(allowedTo("partner"), completeMissionValidator, completeMission);

// Admin/Master routes
router.use(allowedTo("admin", "master"));

router.route("/")
  .post(createMissionValidator, createMission);

router.route("/admin/all")
  .get(getAllMissions);

router.route("/:id/accept/:partnerId")
  .post(acceptApplicationValidator, acceptApplication);

module.exports = router;
