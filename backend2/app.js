import express from "express";
import db, {
    dbRun,
    dbAll,
    initializeDatabase,
    populateDatabase,
    gracefulShutdown,
} from "./db.js";

const app = express();
app.use(express.json());

//#############################################API Endpoints###########################################################################

// 1. Get all appointments for a specific user by user_id
app.get("/appointments/:user_id", async (req, res) => {
    try {
        const userId = req.params.user_id;
        const appointments = await dbAll(
            "SELECT * FROM appointments WHERE user_id = ?",
            [userId]
        );
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Set a new appointment for a specific user
app.post("/appointments", async (req, res) => {
    const { user_id, doctor, date, reason, status } = req.body;

    try {
        await dbRun(
            `INSERT INTO appointments (user_id, doctor, date, reason, status) VALUES (?, ?, ?, ?, ?)`,
            [user_id, doctor, date, reason, status || "Scheduled"]
        );
        res.status(201).send("Appointment created");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Cancel an appointment by setting its status to 'Canceled'
app.put("/appointments/cancel/:appointment_id", async (req, res) => {
    const appointmentId = req.params.appointment_id;

    try {
        const result = await dbRun(
            "UPDATE appointments SET status = ? WHERE id = ?",
            ["Canceled", appointmentId]
        );

        if (result.changes > 0) {
            res.send("Appointment canceled");
        } else {
            res.status(404).send("Appointment not found");
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Reschedule an appointment by updating the date and/or time
app.put("/appointments/reschedule/:appointment_id", async (req, res) => {
    const appointmentId = req.params.appointment_id;
    const { new_date } = req.body;

    try {
        const result = await dbRun(
            "UPDATE appointments SET date = ? WHERE id = ?",
            [new_date, appointmentId]
        );

        if (result.changes > 0) {
            res.send("Appointment rescheduled");
        } else {
            res.status(404).send("Appointment not found");
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add more endpoints as needed...
app.get("/users", async (req, res) => {
    try {
        const users = await dbAll("SELECT * FROM users");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Initialize the database when the server starts
initializeDatabase()
    .then(() => populateDatabase())
    .then(() => {
        console.log("Database initialization and population completed");
    })
    .catch((error) => {
        console.error("Error during database setup:", error);
    });

// Catch signals for graceful shutdown
process.on("SIGINT", gracefulShutdown); // Handle Ctrl+C
process.on("SIGTERM", gracefulShutdown); // Handle termination signals from services like Kubernetes or Docker
