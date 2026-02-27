require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const { generateSchedule, reschedule, updateScheduleStatus } = require('./scheduler');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));



// ---------------------------
// TABLE INITIALIZATION
// ---------------------------

(async () => {
    try {

        // Admin Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admins (
                admin_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                role VARCHAR(50) DEFAULT 'Executive'
            )
        `);

        // Jobs Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS jobs (
                job_id INT AUTO_INCREMENT PRIMARY KEY,
                job_name VARCHAR(100),
                processing_time INT,
                due_date DATETIME,
                priority VARCHAR(20),
                required_machine INT,
                required_skill VARCHAR(50)
            )
        `);

        // Machines Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS machines (
                machine_id INT PRIMARY KEY,
                machine_name VARCHAR(100),
                status VARCHAR(20) DEFAULT 'Available'
            )
        `);

        // Workers Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS workers (
                worker_id INT PRIMARY KEY,
                worker_name VARCHAR(100),
                skill VARCHAR(50),
                shift VARCHAR(50),
                status VARCHAR(20) DEFAULT 'Available'
            )
        `);

        // Schedule Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS schedule (
                schedule_id INT AUTO_INCREMENT PRIMARY KEY,
                job_id INT,
                machine_id INT,
                worker_id INT,
                start_time DATETIME,
                end_time DATETIME,
                status VARCHAR(50) DEFAULT 'Scheduled'
            )
        `);

        // Seed Default Admin
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM admins');
        if (rows[0].count === 0) {
            const defaultPass = await bcrypt.hash('shabari@2026', 10);
            await db.execute(
                'INSERT INTO admins (full_name, username, password, role) VALUES (?, ?, ?, ?)',
                ['Shabari E S', 'shabari', defaultPass, 'Admin']
            );
            console.log("✅ Default Admin Seeded.");
        }

        console.log("✅ Infrastructure Verified.");

    } catch (e) {
        console.error("❌ Initialization Error:", e);
    }
})();


// ---------------------------
// AUTH ROUTES
// ---------------------------

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO admins (full_name, username, password, role) VALUES (?, ?, ?, ?)',
            [fullName, username, hashedPassword, role || 'User']
        );

        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = `session_${admin.username}_${Math.random().toString(36).substring(7)}`;

        res.json({ token, name: admin.full_name, role: admin.role });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------
// JOB ROUTES
// ---------------------------

app.post('/api/addJob', async (req, res) => {
    try {
        const { name, time, dueDate, priority, machine, skill } = req.body;

        const [result] = await db.execute(
            'INSERT INTO jobs (job_name, processing_time, due_date, priority, required_machine, required_skill) VALUES (?, ?, ?, ?, ?, ?)',
            [name, time, dueDate, priority, machine, skill]
        );

        const [rows] = await db.execute('SELECT * FROM jobs WHERE job_id = ?', [result.insertId]);

        res.status(201).json(rows);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jobs', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM jobs');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------
// SCHEDULING ROUTES
// ---------------------------

app.post('/api/generateSchedule', async (req, res) => {
    const result = await generateSchedule();
    if (!result.success) return res.status(500).json(result);
    res.json(result);
});

app.put('/api/reschedule', async (req, res) => {
    const result = await reschedule();
    if (!result.success) return res.status(500).json(result);
    res.json(result);
});

app.get('/api/schedule', async (req, res) => {
    try {
        const query = `
            SELECT s.*, j.job_name, m.machine_name, w.worker_name 
            FROM schedule s
            JOIN jobs j ON s.job_id = j.job_id
            JOIN machines m ON s.machine_id = m.machine_id
            JOIN workers w ON s.worker_id = w.worker_id
            ORDER BY s.start_time ASC
        `;
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------
// DASHBOARD ROUTE
// ---------------------------

app.get('/api/dashboard', async (req, res) => {
    try {

        const [[{ totalJobs }]] = await db.execute('SELECT COUNT(*) as totalJobs FROM jobs');
        const [[{ availMachines }]] = await db.execute('SELECT COUNT(*) as availMachines FROM machines WHERE status = "Available"');
        const [[{ availWorkers }]] = await db.execute('SELECT COUNT(*) as availWorkers FROM workers WHERE status = "Available"');

        const [machines] = await db.execute('SELECT status FROM machines');
        const [workers] = await db.execute('SELECT status FROM workers');

        const machineUtil = machines.length
            ? (machines.filter(m => m.status === 'Busy').length / machines.length) * 100
            : 0;

        const workerUtil = workers.length
            ? (workers.filter(w => w.status === 'Busy').length / workers.length) * 100
            : 0;

        const [todaySchedule] = await db.execute(`
            SELECT s.*, j.job_name, m.machine_name 
            FROM schedule s
            JOIN jobs j ON s.job_id = j.job_id
            JOIN machines m ON s.machine_id = m.machine_id
            WHERE s.status = 'Scheduled' OR s.status='In Progress'
            ORDER BY s.start_time ASC
        `);

        res.json({
            totalJobs,
            availMachines,
            availWorkers,
            machineUtilization: machineUtil.toFixed(1),
            workerUtilization: workerUtil.toFixed(1),
            todaySchedule
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ---------------------------
// AUTO STATUS CHECKER
// ---------------------------

setInterval(async () => {
    await updateScheduleStatus();
}, 10000);


// ---------------------------

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});