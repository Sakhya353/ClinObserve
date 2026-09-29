require('dotenv').config();
const path = require('path'), express = require('express'), mongoose = require('mongoose'), helmet = require('helmet'), cors = require('cors');
const rateLimit = require('express-rate-limit'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), swagger = require('swagger-ui-express'), { z } = require('zod');
const M = require('./models');
const { JWT_SECRET, MONGO_URI, PORT = 5000, CLIENT_URL } = process.env;
if (!JWT_SECRET || !MONGO_URI) { console.error('Set MONGO_URI and JWT_SECRET in .env (see .env.example)'); process.exit(1); }

const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], frameSrc: ["'self'", 'about:'], connectSrc: ["'self'"] } } }));
app.use(cors({ origin: CLIENT_URL || true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60000, max: 200 }));

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Authentication required' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden for your role' });
  next();
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const list = (Model, fields, sort = '-date') => wrap(async (req, res) => {
  const { q, page = 1, limit = 20, sort: sk = sort, ...f } = req.query, w = {};
  if (typeof q === 'string' && q) w.$or = fields.map(k => ({ [k]: new RegExp(esc(q), 'i') }));
  for (const k in f) if (typeof f[k] === 'string' && Model.schema.path(k)) w[k] = f[k]; // strings only: blocks NoSQL operator injection
  const lim = Math.min(+limit || 20, 100), pg = Math.max(+page || 1, 1);
  const [data, total] = await Promise.all([Model.find(w).sort(String(sk)).skip((pg - 1) * lim).limit(lim).lean(), Model.countDocuments(w)]);
  res.json({ data, total, page: pg, pages: Math.ceil(total / lim) });
});
const byId = (Model, key) => wrap(async (req, res) => { const d = await Model.findOne({ [key]: String(req.params.id) }).lean(); d ? res.json(d) : res.status(404).json({ error: 'Not found' }); });
const grp = (Model, field, extra = {}) => Model.aggregate([{ $group: { _id: '$' + field, count: { $sum: 1 }, ...extra } }, { $sort: { count: -1 } }]);
const month = (Model, f = 'date') => Model.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$' + f } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);

app.get('/api/health', (req, res) => res.json({ status: 'ok', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', ai: 'demo-mode', time: new Date() }));
app.post('/api/auth/login', wrap(async (req, res) => {
  const r = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Invalid input' });
  const u = await M.User.findOne({ email: r.data.email.toLowerCase() });
  if (!u || !(await bcrypt.compare(r.data.password, u.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
  await M.AuditLog.create({ user: u.email, action: 'LOGIN', entity: 'User', entityId: String(u._id) });
  res.json({ token: jwt.sign({ id: u._id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: '8h' }), user: { name: u.name, role: u.role } });
}));

const api = express.Router(); api.use(auth()); app.use('/api', api);
api.get('/dashboard', wrap(async (req, res) => {
  const avg = f => M.Consultation.aggregate([{ $group: { _id: null, v: { $avg: '$' + f } } }]).then(r => Math.round(r[0]?.v || 0));
  const [patients, consultations, activeObservations, medications, followUps, doctors, availableDoctors, avgWaitingMinutes, avgDurationMinutes] = await Promise.all([
    M.Patient.countDocuments(), M.Consultation.countDocuments(), M.Observation.countDocuments({ status: 'Active' }), M.Medication.countDocuments(), M.FollowUp.countDocuments(),
    M.Doctor.countDocuments(), M.Doctor.countDocuments({ available: true }), avg('waitingMinutes'), avg('durationMinutes')]);
  res.json({ patients, consultations, activeObservations, medications, followUps, doctors, availableDoctors, avgWaitingMinutes, avgDurationMinutes });
}));
api.get('/patients', list(M.Patient, ['patientId', 'name', 'department'], 'patientId'));
api.get('/patients/:id', wrap(async (req, res) => {
  const p = await M.Patient.findOne({ patientId: String(req.params.id) }).lean(); if (!p) return res.status(404).json({ error: 'Not found' });
  const [consultations, observations, medications] = await Promise.all(['Consultation', 'Observation', 'Medication'].map(n => M[n].find({ patientId: p.patientId }).sort('-date').lean()));
  res.json({ ...p, consultations, observations, medications });
}));
api.get('/doctors', list(M.Doctor, ['doctorId', 'name', 'department'], 'doctorId')); api.get('/doctors/:id', byId(M.Doctor, 'doctorId'));
api.get('/departments', wrap(async (req, res) => res.json(await M.Consultation.aggregate([
  { $group: { _id: '$department', consultations: { $sum: 1 }, avgWaiting: { $avg: '$waitingMinutes' }, avgDuration: { $avg: '$durationMinutes' }, followUps: { $sum: { $cond: ['$followUp', 1, 0] } } } }, { $sort: { _id: 1 } }]))));
api.get('/appointments', list(M.Appointment, ['appointmentId', 'patientId', 'department']));
api.get('/consultations', list(M.Consultation, ['consultationId', 'patientId', 'doctorId', 'department', 'status'])); api.get('/consultations/:id', byId(M.Consultation, 'consultationId'));
api.get('/observations', list(M.Observation, ['observationId', 'patientId', 'department', 'type'])); api.get('/observations/:id', byId(M.Observation, 'observationId'));
api.get('/medications', list(M.Medication, ['medicationId', 'patientId', 'medication', 'department'])); api.get('/medications/:id', byId(M.Medication, 'medicationId'));
api.get('/search', wrap(async (req, res) => {
  const q = new RegExp(esc(String(req.query.q || '')), 'i'), t = { limit: 5 }, f = (Mo, keys) => Mo.find({ $or: keys.map(k => ({ [k]: q })) }).limit(5).lean();
  const [patients, doctors, consultations, observations, medications] = await Promise.all([f(M.Patient, ['patientId', 'name']), f(M.Doctor, ['doctorId', 'name']), f(M.Consultation, ['consultationId', 'department']), f(M.Observation, ['observationId', 'type']), f(M.Medication, ['medicationId', 'medication'])]);
  res.json({ patients, doctors, consultations, observations, medications });
}));
const an = express.Router(); api.use('/analytics', an);
an.get('/overview', wrap(async (req, res) => res.json({ consultationsByMonth: await month(M.Consultation), observationsByMonth: await month(M.Observation), medicationsByMonth: await month(M.Medication, 'startDate') })));
an.get('/departments', wrap(async (req, res) => res.json(await grp(M.Consultation, 'department'))));
an.get('/doctors', wrap(async (req, res) => res.json(await grp(M.Consultation, 'doctorId'))));
an.get('/consultations', wrap(async (req, res) => res.json({ status: await grp(M.Consultation, 'status'), type: await grp(M.Consultation, 'type'), byMonth: await month(M.Consultation) })));
an.get('/observations', wrap(async (req, res) => res.json({ status: await grp(M.Observation, 'status'), type: await grp(M.Observation, 'type'), department: await grp(M.Observation, 'department'), followUp: await grp(M.Observation, 'followUpRequired') })));
an.get('/medications', wrap(async (req, res) => res.json({ top: await grp(M.Medication, 'medication'), status: await grp(M.Medication, 'status'), route: await grp(M.Medication, 'route'), department: await grp(M.Medication, 'department') })));
an.get('/waiting', wrap(async (req, res) => res.json(await M.Consultation.aggregate([{ $group: { _id: '$department', avgWaiting: { $avg: '$waitingMinutes' }, maxWaiting: { $max: '$waitingMinutes' } } }, { $sort: { avgWaiting: -1 } }]))));
api.get('/reports', wrap(async (req, res) => res.json({ generatedAt: new Date(), types: ['Daily Consultation', 'Weekly Consultation', 'Department Activity', 'Patient Flow', 'Observation', 'Medication Record', 'Waiting Time', 'Doctor Workload'], departmentActivity: await grp(M.Consultation, 'department') })));
api.get('/notifications', wrap(async (req, res) => res.json(await M.Notification.find().sort('-createdAt').limit(50).lean())));
api.get('/audit-logs', auth('Admin'), list(M.AuditLog, ['user', 'action', 'entity'], '-createdAt'));
api.post('/ai/summarize', wrap(async (req, res) => {
  if (/diagnos|treat|prescrib|dosage|recommend|predict/i.test(String(req.body?.prompt || ''))) return res.status(400).json({ error: 'This assistant only provides operational summaries. It never diagnoses, recommends treatment or medication, or predicts outcomes.' });
  const [d, w, a] = await Promise.all([grp(M.Consultation, 'department'), M.Consultation.aggregate([{ $group: { _id: '$department', v: { $avg: '$waitingMinutes' } } }, { $sort: { v: -1 } }]), M.Medication.countDocuments({ status: 'Active' })]);
  res.json({ summary: `${d[0]._id} has the highest consultation volume (${d[0].count}). ${w[0]._id} has the longest average waiting time (${Math.round(w[0].v)} min). ${a} medication records are Active.`, notice: 'AI-generated analytical summary based on synthetic data. Not medical advice.' });
}));

const paths = {}; ['health', 'dashboard', 'patients', 'patients/{id}', 'doctors', 'doctors/{id}', 'departments', 'appointments', 'consultations', 'consultations/{id}', 'observations', 'observations/{id}', 'medications', 'medications/{id}', 'search', 'analytics/overview', 'analytics/departments', 'analytics/doctors', 'analytics/consultations', 'analytics/observations', 'analytics/medications', 'analytics/waiting', 'reports', 'notifications', 'audit-logs'].forEach(p => paths['/api/' + p] = { get: { summary: p, responses: { 200: { description: 'OK' } } } });
paths['/api/auth/login'] = { post: { summary: 'Login', responses: { 200: { description: 'JWT token' } } } }; paths['/api/ai/summarize'] = { post: { summary: 'Operational summary', responses: { 200: { description: 'OK' } } } };
app.use('/api-docs', swagger.serve, swagger.setup({ openapi: '3.0.0', info: { title: 'ClinObserve API (synthetic data)', version: '1.0.0' }, paths }));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Something went wrong' }); }); // sanitized

mongoose.connect(MONGO_URI).then(() => app.listen(PORT, () => console.log(`ClinObserve on http://localhost:${PORT}  (API docs: /api-docs)`))).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
