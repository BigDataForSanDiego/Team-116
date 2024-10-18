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

    // Create the medical_history table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS medical_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date DATE,
            type TEXT,
            description TEXT,
            doctor TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
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
// Populate database with sample data
// Populate database with sample data
export async function populateDatabase() {
    const sampleUsers = [
        {
            user_id: "12345678",
            password: "password123",
            phone_number: "+1234567890",
            name: "John Doe",
            date_of_birth: "1992-05-15",
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
            date_of_birth: "1992-12-10",
            allergies: "None",
            conditions: "None",
            medications: "None",
            last_visit: "2024-01-10",
            primary_doctor: "Dr. Johnson",
        },
        {
            user_id: "1235678",
            password: "password235",
            phone_number: "+16196353351",
            name: "Remington Steele",
            date_of_birth: "2004-07-28",
            allergies: "Chocolate",
            conditions: "Asthma",
            medications: "Retinol",
            last_visit: "2024-01-10",
            primary_doctor: "Dr. Steele",
        },
    ];

    const sampleMedicalHistory = [
        {
            phone_number: "+1234567890",
            date: "2024-03-15",
            type: "Check-up",
            description:
                "Regular blood pressure check. BP: 125/82. Prescribed medication refill.",
            doctor: "Dr. Smith",
        },
        {
            phone_number: "+1234567890",
            date: "2024-02-01",
            type: "Urgent Care",
            description:
                "Acute asthma exacerbation. Administered nebulizer treatment.",
            doctor: "Dr. Johnson",
        },
        {
            phone_number: "+1234567891",
            date: "2024-03-10",
            type: "Check-up",
            description:
                "Routine check-up. All vitals normal. No concerns raised.",
            doctor: "Dr. Johnson",
        },
    ];

    // Insert sample users only if they do not already exist
    for (const user of sampleUsers) {
        try {
            const existingUser = await dbGet(
                "SELECT id FROM users WHERE user_id = ?",
                [user.user_id]
            );
            if (!existingUser) {
                await dbRun(
                    `INSERT INTO users (user_id, password, phone_number, name, date_of_birth, allergies, conditions, medications, last_visit, primary_doctor)
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
                console.log(`User ${user.name} added to the database.`);
            }
        } catch (err) {
            console.error("Error inserting user:", err);
        }
    }

    // Insert sample medical history only if it doesn't already exist
    for (const history of sampleMedicalHistory) {
        try {
            // Get the user_id of the user based on their phone_number
            const user = await dbGet(
                "SELECT id FROM users WHERE phone_number = ?",
                [history.phone_number]
            );
            if (user) {
                const existingHistory = await dbGet(
                    "SELECT id FROM medical_history WHERE user_id = ? AND date = ? AND type = ?",
                    [user.id, history.date, history.type]
                );
                if (!existingHistory) {
                    await dbRun(
                        `INSERT INTO medical_history (user_id, date, type, description, doctor)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            user.id,
                            history.date,
                            history.type,
                            history.description,
                            history.doctor,
                        ]
                    );
                    console.log(
                        `Medical history added for user with phone: ${history.phone_number}.`
                    );
                }
            }
        } catch (err) {
            console.error("Error inserting medical history:", err);
        }
    }

    console.log("Sample data population completed.");
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
