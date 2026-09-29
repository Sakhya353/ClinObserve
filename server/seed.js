// Deterministic SYNTHETIC data. No real people or records. Run: npm run seed
require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs'), M = require('./models');
let s = 2026;
const R = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const P = a => a[R() * a.length | 0], N = (a, b) => a + (R() * (b - a + 1) | 0), pd = (n, l) => String(n).padStart(l, '0');
const day = d => new Date(Date.UTC(2026, 8, 29) - d * 864e5);
const DEPTS = ['General Medicine', 'Cardiology', 'Neurology', 'Orthopaedics', 'Dermatology', 'Gastroenterology', 'Pulmonology', 'Nephrology', 'Endocrinology', 'ENT', 'Ophthalmology', 'Psychiatry'];
const FN = ['Ananya', 'Rahul', 'Priya', 'Amit', 'Neha', 'Vikram', 'Kavya', 'Arjun', 'Meera', 'Rohan', 'Sana', 'Ishaan'], LN = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Singh', 'Gupta', 'Rao', 'Das', 'Mehta', 'Khan'];
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(M).filter(x => x.deleteMany).map(x => x.deleteMany({})));
  const hash = await bcrypt.hash('Demo@1234', 10); // DEMO password only
  await M.User.insertMany(M.ROLES.map(r => ({ email: r.toLowerCase().replace(/ /g, '.') + '@clinobserve.demo', name: 'Demo ' + r, role: r, passwordHash: hash })));
  await M.Department.insertMany(DEPTS.map(name => ({ name })));
  const doctors = Array.from({ length: 50 }, (_, i) => ({ doctorId: 'DOC-' + pd(i + 1, 4), name: 'Dr. Demo ' + (i + 1), department: DEPTS[i % 12], specialization: DEPTS[i % 12] + ' Specialist', experienceYears: N(3, 28), available: R() > .32 }));
  await M.Doctor.insertMany(doctors);
  const patients = Array.from({ length: 500 }, (_, i) => { const d = P(DEPTS); return { patientId: 'PAT-' + pd(i + 1, 5), name: P(FN) + ' ' + P(LN), age: N(4, 90), gender: P(['Female', 'Male', 'Other']), department: d, location: 'Zone ' + P('ABCDE'), registeredAt: day(N(60, 900)), doctorId: P(doctors.filter(x => x.department === d)).doctorId }; });
  await M.Patient.insertMany(patients);
  await M.Appointment.insertMany(Array.from({ length: 500 }, (_, i) => { const p = P(patients); return { appointmentId: 'APT-' + pd(i + 1, 5), patientId: p.patientId, doctorId: p.doctorId, department: p.department, date: day(N(0, 89)), time: pd(N(8, 16), 2) + ':' + P(['00', '15', '30', '45']) }; }));
  const cons = Array.from({ length: 800 }, (_, i) => { const p = P(patients); return { consultationId: 'CON-' + pd(i + 1, 5), patientId: p.patientId, doctorId: p.doctorId, department: p.department, date: day(N(0, 89)), waitingMinutes: N(5, 55), durationMinutes: N(10, 60), type: P(['OPD', 'OPD', 'Routine', 'Follow-up', 'Review', 'Observation']), status: P(['Completed', 'Completed', 'Completed', 'Scheduled', 'Waiting', 'In Consultation', 'Follow-up', 'Cancelled']), followUp: R() < .38 }; });
  await M.Consultation.insertMany(cons);
  await M.Observation.insertMany(Array.from({ length: 1000 }, (_, i) => { const c = P(cons); return { observationId: 'OBS-' + pd(i + 1, 5), patientId: c.patientId, consultationId: c.consultationId, doctorId: c.doctorId, department: c.department, date: c.date, type: P(['Routine', 'Routine', 'Follow-up', 'Administrative', 'Monitoring', 'Review', 'Attention Required']), status: P(['Completed', 'Completed', 'Active', 'Pending', 'Reviewed']), followUpRequired: R() < .3, symptomNote: 'Synthetic note for demonstration only', vitals: { heartRate: N(58, 110), bloodPressure: N(100, 145) + '/' + N(60, 92), temperatureF: +(97 + R() * 2.6).toFixed(1), spo2: N(93, 100), respiratoryRate: N(12, 22) } }; }));
  await M.Medication.insertMany(Array.from({ length: 700 }, (_, i) => { const c = P(cons), st = N(0, 120); return { medicationId: 'MED-' + pd(i + 1, 5), patientId: c.patientId, consultationId: c.consultationId, doctorId: c.doctorId, department: c.department, medication: 'Synthetic Medication ' + P('ABCDEFG'), dosage: P([100, 250, 500, 750]) + ' mg', frequency: P(['Once daily', 'Twice daily', 'Thrice daily', 'Weekly']), route: P(['Oral', 'Oral', 'Oral', 'Topical', 'Injection', 'Other']), startDate: day(st), endDate: day(Math.max(0, st - N(5, 60))), status: P(['Active', 'Completed', 'Completed', 'Discontinued', 'Historical']) }; }));
  await M.FollowUp.insertMany(Array.from({ length: 300 }, (_, i) => { const c = P(cons); return { followUpId: 'FUP-' + pd(i + 1, 4), consultationId: c.consultationId, patientId: c.patientId, dueDate: day(N(-30, 60)), status: P(['Scheduled', 'Done', 'Missed']) }; }));
  await M.AuditLog.insertMany(Array.from({ length: 1500 }, () => ({ user: P(M.ROLES).toLowerCase().replace(/ /g, '.') + '@clinobserve.demo', action: P(['VIEW', 'SEARCH', 'EXPORT', 'LOGIN']), entity: P(['Patient', 'Consultation', 'Observation', 'Medication']), entityId: 'SYN-' + pd(N(1, 999), 4) })));
  await M.Notification.insertMany([{ title: 'Synthetic data loaded', message: 'Demo dataset is ready.' }, { title: 'Waiting time alert', message: 'Synthetic operational alert.' }]);
  console.log('Seed complete: 500 patients, 50 doctors, 12 departments, 800 consultations, 1000 observations, 700 medications, 500 appointments, 300 follow-ups, 1500 audit logs');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
