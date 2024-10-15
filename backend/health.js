const express = require('express');
const { Patient, Doctor, HealthData, sequelize } = require('./models');

const app = express();
app.use(express.json());

// Function to get patient data
async function getPatientData(patientId) {
    try {
        const patient = await Patient.findByPk(patientId, {
            include: [{ model: HealthData }, { model: Doctor }]
        });
        return patient ? patient.toJSON() : null;
    } catch (error) {
        console.error('Error fetching patient data:', error);
        return null;
    }
}

// Function to book an appointment
async function bookAppointment(patientId, doctorId, date) {
    try {
        const patient = await Patient.findByPk(patientId);
        const doctor = await Doctor.findByPk(doctorId);
        if (!patient || !doctor) {
            return { success: false, message: 'Patient or Doctor not found' };
        }
        // In a real application, you'd have an Appointment model
        // For simplicity, we'll just return a success message
        return { success: true, message: `Appointment booked for ${patient.name} with Dr. ${doctor.name} on ${date}` };
    } catch (error) {
        console.error('Error booking appointment:', error);
        return { success: false, message: 'Error booking appointment' };
    }
}

// Function to send email to doctor
async function sendEmailToDoctor(doctorId, message) {
    try {
        const doctor = await Doctor.findByPk(doctorId);
        if (!doctor) {
            return { success: false, message: 'Doctor not found' };
        }
        // In a real application, you'd implement email sending logic here
        console.log(`Email sent to Dr. ${doctor.name}: ${message}`);
        return { success: true, message: `Email sent to Dr. ${doctor.name}` };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, message: 'Error sending email' };
    }
}

// Existing routes...

// New route for function calling
app.post('/function-call', async (req, res) => {
    const { name, arguments: args } = req.body;

    switch (name) {
        case 'getPatientData':
            const patientData = await getPatientData(args.patientId);
            res.json(patientData);
            break;
        case 'bookAppointment':
            const bookingResult = await bookAppointment(args.patientId, args.doctorId, args.date);
            res.json(bookingResult);
            break;
        case 'sendEmailToDoctor':
            const emailResult = await sendEmailToDoctor(args.doctorId, args.message);
            res.json(emailResult);
            break;
        default:
            res.status(400).json({ error: 'Unknown function' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});