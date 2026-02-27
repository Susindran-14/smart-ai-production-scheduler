-- Create database (if not already created)
CREATE DATABASE IF NOT EXISTS smartsched;
USE smartsched;

-- =========================
-- Jobs table
-- =========================
CREATE TABLE jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    job_name TEXT NOT NULL,
    processing_time INT NOT NULL, 
    due_date TIMESTAMP NOT NULL,
    priority ENUM('High', 'Medium', 'Low'),
    required_machine TEXT NOT NULL,
    required_skill TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Machines table
-- =========================
CREATE TABLE machines (
    machine_id VARCHAR(50) PRIMARY KEY,
    machine_name TEXT NOT NULL,
    status ENUM('Available', 'Busy', 'Breakdown', 'Maintenance') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Workers table
-- =========================
CREATE TABLE workers (
    worker_id VARCHAR(50) PRIMARY KEY,
    worker_name TEXT NOT NULL,
    skill TEXT NOT NULL,
    shift TEXT NOT NULL,
    status ENUM('Available', 'Leave') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Schedule table
-- =========================
CREATE TABLE schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT,
    machine_id VARCHAR(50),
    worker_id VARCHAR(50),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE
);