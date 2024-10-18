import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./sqlite3.db"); // Keep the connection open

// Define database helper functions
export const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

export const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

export const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

// Initialize database with medical-related tables
export async function initializeDatabase() {
    // Ensure the users table exists
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE,
            password TEXT,
            phone_number TEXT UNIQUE,
            name TEXT,
            date_of_birth DATE,
            allergies TEXT,
            conditions TEXT,
            medications TEXT,
            last_visit DATE,
            primary_doctor TEXT
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            doctor TEXT,
            date DATETIME,
            reason TEXT,
            status TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
}

// Populate database with sample data
export async function populateDatabase() {
    const sampleUsers = [
        {
            user_id: "12345678",
            password: "password123",
            phone_number: "+1234567890",
            name: "John Doe",
            date_of_birth: "1980-05-15",
            allergies: "Penicillin, Peanuts",
            conditions: "Hypertension, Asthma",
            medications: "Lisinopril 10mg, Albuterol inhaler",
            last_visit: "2024-03-15",
            primary_doctor: "Dr. Smith",
        },
        {
            user_id: "23456789",
            password: "password234",
            phone_number: "+1234567891",
            name: "Jane Smith",
            date_of_birth: "1992-10-12",
            allergies: "None",
            conditions: "None",
            medications: "None",
            last_visit: "2024-01-10",
            primary_doctor: "Dr. Johnson",
        },
    ];

    for (const user of sampleUsers) {
        try {
            await dbRun(
                `INSERT OR IGNORE INTO users (user_id, password, phone_number, name, date_of_birth, allergies, conditions, medications, last_visit, primary_doctor)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.user_id,
                    user.password,
                    user.phone_number,
                    user.name,
                    user.date_of_birth,
                    user.allergies,
                    user.conditions,
                    user.medications,
                    user.last_visit,
                    user.primary_doctor,
                ]
            );
        } catch (err) {
            console.error("Error inserting user:", err);
        }
    }

    console.log("Sample data has been populated in the database");
}

// Graceful shutdown: Close the database connection when the app closes
export function gracefulShutdown() {
    console.log("Closing database connection...");
    db.close((err) => {
        if (err) {
            console.error("Error closing the database:", err.message);
        } else {
            console.log("Database connection closed.");
        }
        process.exit(0); // Exit the process once the database is closed
    });
}

// Export the db connection so it can be used in the main app
export default db;
