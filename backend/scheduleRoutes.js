// routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/schedulerController");

router.post("/run", controller.runScheduler);
router.get("/", controller.getSchedule);

module.exports = router;