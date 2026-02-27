// controllers/schedulerController.js
const pool = require("../db");
const generateSmartSchedule = require("../aiScheduler");

exports.runScheduler = async (req, res) => {
  try {
    await generateSmartSchedule(pool);
    res.json({ message: "Smart Schedule Generated Successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Scheduling Failed" });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT s.*, j.job_name, m.machine_name, w.worker_name
      FROM schedule s
      JOIN jobs j ON s.job_id = j.job_id
      JOIN machines m ON s.machine_id = m.machine_id
      JOIN workers w ON s.worker_id = w.worker_id
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
};