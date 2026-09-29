const m = require('mongoose');
const mk = (n, d) => m.model(n, new m.Schema(d, { timestamps: true }));
const ROLES = ['Admin', 'Doctor', 'Clinical Observer', 'Operations Manager', 'Research Analyst'];
module.exports = {
  ROLES,
  User: mk('User', { email: { type: String, unique: true }, name: String, role: { type: String, enum: ROLES }, passwordHash: String }),
  Department: mk('Department', { name: { type: String, unique: true } }),
  Doctor: mk('Doctor', { doctorId: { type: String, unique: true, index: true }, name: String, department: String, specialization: String, experienceYears: Number, available: Boolean }),
  Patient: mk('Patient', { patientId: { type: String, unique: true, index: true }, name: String, age: Number, gender: String, department: String, location: String, registeredAt: Date, doctorId: String }),
  Appointment: mk('Appointment', { appointmentId: { type: String, unique: true }, patientId: { type: String, index: true }, doctorId: String, department: String, date: Date, time: String }),
  Consultation: mk('Consultation', { consultationId: { type: String, unique: true, index: true }, patientId: { type: String, index: true }, doctorId: String, department: String, date: Date, waitingMinutes: Number, durationMinutes: Number, type: String, status: String, followUp: Boolean }),
  Observation: mk('Observation', { observationId: { type: String, unique: true, index: true }, patientId: { type: String, index: true }, consultationId: String, doctorId: String, department: String, date: Date, type: String, status: String, followUpRequired: Boolean, symptomNote: String, vitals: { heartRate: Number, bloodPressure: String, temperatureF: Number, spo2: Number, respiratoryRate: Number } }),
  Medication: mk('Medication', { medicationId: { type: String, unique: true, index: true }, patientId: { type: String, index: true }, consultationId: String, doctorId: String, department: String, medication: String, dosage: String, frequency: String, route: String, startDate: Date, endDate: Date, status: String }),
  FollowUp: mk('FollowUp', { followUpId: { type: String, unique: true }, consultationId: String, patientId: String, dueDate: Date, status: String }),
  Notification: mk('Notification', { title: String, message: String, read: { type: Boolean, default: false } }),
  AuditLog: mk('AuditLog', { user: String, action: String, entity: String, entityId: String })
};
