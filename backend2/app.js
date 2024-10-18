import express from "express";
import db, {
    dbAll,
    dbRun,
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

// 2. Get all medical history for a specific user by user_id
app.get("/medical-history/:user_id", async (req, res) => {
    try {
        const userId = req.params.user_id;
        const medicalHistory = await dbAll(
            "SELECT * FROM medical_history WHERE user_id = ?",
            [userId]
        );
        res.json(medicalHistory);
    } catch (err) {
        console.error("Error creating appointment:", err); // Log the error
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
