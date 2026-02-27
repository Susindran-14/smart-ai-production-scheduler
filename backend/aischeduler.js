// aiScheduler.js
function getPriorityScore(priority) {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

function getUrgencyScore(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffHours = (due - now) / (1000 * 60 * 60);

  if (diffHours < 24) return 3;
  if (diffHours < 72) return 2;
  return 1;
}

async function generateSmartSchedule(pool) {
  console.log("🔁 Running Smart Rescheduler...");

  // Clear old schedule (optional strategy)
  await pool.execute("DELETE FROM schedule");

  const [jobs] = await pool.execute("SELECT * FROM jobs");
  const [machines] = await pool.execute(
    "SELECT * FROM machines WHERE status='Available'"
  );
  const [workers] = await pool.execute(
    "SELECT * FROM workers WHERE status='Available'"
  );

  for (let job of jobs) {
    let bestScore = -Infinity;
    let bestAssignment = null;

    for (let machine of machines) {
      if (machine.machine_id !== job.required_machine) continue;

      for (let worker of workers) {
        if (worker.skill !== job.required_skill) continue;

        let score =
          getPriorityScore(job.priority) +
          getUrgencyScore(job.due_date);

        if (score > bestScore) {
          bestScore = score;
          bestAssignment = { job, machine, worker };
        }
      }
    }

    if (bestAssignment) {
      await pool.execute(
        `INSERT INTO schedule 
        (job_id, machine_id, worker_id, start_time, end_time)
        VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [
          bestAssignment.job.job_id,
          bestAssignment.machine.machine_id,
          bestAssignment.worker.worker_id,
          bestAssignment.job.processing_time
        ]
      );
    }
  }

  console.log("✅ Rescheduling Complete");
}

module.exports = generateSmartSchedule;