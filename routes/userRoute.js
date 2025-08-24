const express = require("express");
// const {} = require("../controllers/authController");
const {
  activateAccount,
  deactivateAccount,
  promoteOrDemoteUser,
  deleteUser,
  getUserById,
  getUsers,
  getUserByEmail,
} = require("../controllers/userController");
const {
  getUserValidator,
  deleteUserValidator,
  getUserByEmailValidator,
  promoteUserValidator,
  activateAccountOrDeactivateValidator,
} = require("../utils/validators/userValidator");
const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

router.use(protect, allowedTo("admin", "master"));

router.route("/").get(getUsers);
router.route("/getUserByEmail").get(getUserByEmailValidator, getUserByEmail);

router
  .route("/:id")
  .get(getUserValidator, getUserById)
  .delete(deleteUserValidator, deleteUser);

router.route("/:id/promote").patch(promoteUserValidator, promoteOrDemoteUser);

router
  .route("/:id/deactivate")
  .delete(activateAccountOrDeactivateValidator, deactivateAccount);
router
  .route("/:id/activate")
  .post(activateAccountOrDeactivateValidator, activateAccount);

module.exports = router;
