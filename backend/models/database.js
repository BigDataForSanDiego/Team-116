const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './test.db',
});

const Patient = sequelize.define('Patient', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    age: DataTypes.INTEGER,
    address: DataTypes.STRING,
});

const Doctor = sequelize.define('Doctor', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    specialty: DataTypes.STRING,
});

const HealthData = sequelize.define('HealthData', {
    data: DataTypes.TEXT,
    blood_pressure: DataTypes.STRING,
    heart_rate: DataTypes.STRING,
    diagnosis: DataTypes.TEXT,
});

Patient.belongsToMany(Doctor, { through: 'DoctorPatient' });
Doctor.belongsToMany(Patient, { through: 'DoctorPatient' });
HealthData.belongsTo(Patient);

(async () => {
    await sequelize.sync(); // Sync all defined models to the DB
})();

module.exports = { Patient, Doctor, HealthData, sequelize };
