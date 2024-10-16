import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./sqlite3.db');

// Define database helper functions
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// Initialize database with medical-related tables
async function initializeDatabase() {
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
            last_visit DATE
        )
    `);

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

    await dbRun(`
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            doctor TEXT,
            subject TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Add the calls table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            transcript TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
}

// Sample data for testing
const sampleUsers = [
    {
        user_id: '12345678',
        password: '123456',
        phone_number: '+1234567890',
        name: 'John Doe',
        date_of_birth: '1980-05-15',
        allergies: 'Penicillin, Peanuts',
        conditions: 'Hypertension, Asthma',
        medications: 'Lisinopril 10mg, Albuterol inhaler',
        last_visit: '2024-03-15'
    }
];

// Sample medical history data
const sampleMedicalHistory = [
    {
        phone_number: '+1234567890',
        date: '2024-03-15',
        type: 'Check-up',
        description: 'Regular blood pressure check. BP: 125/82. Prescribed medication refill.',
        doctor: 'Dr. Smith'
    },
    {
        phone_number: '+1234567890',
        date: '2024-02-01',
        type: 'Urgent Care',
        description: 'Acute asthma exacerbation. Administered nebulizer treatment.',
        doctor: 'Dr. Johnson'
    }
];

// Function to populate sample data
async function populateDatabase() {
    // Insert sample users
    for (const user of sampleUsers) {
        try {
            await dbRun(
                `INSERT OR IGNORE INTO users (user_id, password, phone_number, name, date_of_birth, allergies, conditions, medications, last_visit)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.user_id, user.password, user.phone_number, user.name, user.date_of_birth, user.allergies, user.conditions, user.medications, user.last_visit]
            );
        } catch (err) {
            console.error('Error inserting user:', err);
        }
    }

    // Insert sample medical history
    for (const history of sampleMedicalHistory) {
        try {
            // Get user_id first
            const user = await dbGet('SELECT id FROM users WHERE phone_number = ?', [history.phone_number]);
            if (user) {
                await dbRun(
                    `INSERT INTO medical_history (user_id, date, type, description, doctor)
                     VALUES (?, ?, ?, ?, ?)`,
                    [user.id, history.date, history.type, history.description, history.doctor]
                );
            }
        } catch (err) {
            console.error('Error inserting medical history:', err);
        }
    }
    
    console.log('Sample data has been populated in the database');
}

// Initialize and populate the database
initializeDatabase()
    .then(() => populateDatabase())
    .then(() => {
        console.log('Database initialization and population completed');
        db.close();
    })
    .catch(error => {
        console.error('Error during database setup:', error);
        db.close();
    });
