const express = require('express');
const { Patient, Doctor, HealthData, sequelize } = require('./models');

const app = express();
app.use(express.json());

// API Route to create a new patient
app.post('/patients', async (req, res) => {
    try {
        const patient = await Patient.create(req.body);
        res.json(patient);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Route to create a new doctor
app.post('/doctors', async (req, res) => {
    try {
        const doctor = await Doctor.create(req.body);
        res.json(doctor);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Route to add health data to a patient
app.post('/patients/:id/healthdata', async (req, res) => {
    try {
        const patient = await Patient.findByPk(req.params.id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const healthData = await HealthData.create({ ...req.body, PatientId: patient.id });
        res.json(healthData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Route to assign patients to a doctor
app.post('/doctors/:doctorId/patients/:patientId', async (req, res) => {
    try {
        const doctor = await Doctor.findByPk(req.params.doctorId);
        const patient = await Patient.findByPk(req.params.patientId);
        if (!doctor || !patient) {
            return res.status(404).json({ error: 'Doctor or Patient not found' });
        }
        await doctor.addPatient(patient);
        res.json({ message: 'Patient assigned to doctor' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Route to view all patients of a specific doctor
app.get('/doctors/:id/patients', async (req, res) => {
    try {
        const doctor = await Doctor.findByPk(req.params.id, {
            include: Patient,
        });
        res.json(doctor.Patients);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// add async after = if using db calls
const getDeliveryDate = (orderId) => {
    orderId += '5'
    deliveryDate = '9/27/2024'
    return deliveryDate
}



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
