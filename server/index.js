import 'dotenv/config';
import express from 'express';
import cookieSession from 'cookie-session';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_DATA } from '../src/data.js';

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, 'data');
const dataFile = path.join(dataDir, 'objectives.json');
const frontendDir = path.resolve(here, '../dist');
const adminPassword = process.env.ADMIN_PASSWORD;

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(cookieSession({
  name: 'valorant-race-admin',
  keys: [process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000
}));

async function readStore() {
  try {
    const saved = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    return {
      ...structuredClone(INITIAL_DATA), ...saved,
      objectiveHistory: saved.objectiveHistory || saved.history || {},
      evaluations: saved.evaluations || [], redeemed: saved.redeemed || []
    };
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const initial = { ...structuredClone(INITIAL_DATA), objectiveHistory: {} };
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ error: 'Acesso administrativo necessário.' });
}

app.get('/api/objectives', async (_req, res, next) => {
  try { res.json(await readStore()); } catch (error) { next(error); }
});

app.get('/api/data', async (_req, res, next) => {
  try { res.json(await readStore()); } catch (error) { next(error); }
});

app.get('/api/auth/me', (req, res) => res.json({ authenticated: Boolean(req.session?.isAdmin) }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', (req, res) => {
  if (!adminPassword) return res.status(503).json({ error: 'Configure ADMIN_PASSWORD no arquivo .env do servidor.' });
  if (typeof req.body?.password !== 'string' || req.body.password !== adminPassword) return res.status(401).json({ error: 'Senha incorreta.' });
  req.session = { isAdmin: true };
  return res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ authenticated: false }); });

app.put('/api/objectives/:playerId', requireAdmin, async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const descriptions = req.body?.objectives;
    if (!INITIAL_DATA.players.some(player => player.id === playerId)) return res.status(404).json({ error: 'Jogador não encontrado.' });
    if (!Array.isArray(descriptions) || descriptions.length !== 5 || descriptions.some(value => typeof value !== 'string' || !value.trim() || value.length > 140)) {
      return res.status(400).json({ error: 'Informe exatamente cinco objetivos, com até 140 caracteres cada.' });
    }
    const store = await readStore();
    const previous = store.objectives[playerId] || [];
    const history = store.objectiveHistory[playerId] || [];
    descriptions.forEach((description, index) => {
      if (previous[index] && previous[index] !== description.trim()) history.push({ description: previous[index], status: 'Substituído', changedAt: new Date().toISOString() });
    });
    store.objectives[playerId] = descriptions.map(value => value.trim());
    store.objectiveHistory[playerId] = history;
    await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
    return res.json(store);
  } catch (error) { return next(error); }
});

app.post('/api/evaluations', requireAdmin, async (req, res, next) => {
  try {
    const incoming = req.body?.evaluations;
    if (!Array.isArray(incoming) || incoming.length !== INITIAL_DATA.players.length) return res.status(400).json({ error: 'Envie uma avaliação para cada jogador.' });
    const store = await readStore();
    for (const item of incoming) {
      if (!INITIAL_DATA.players.some(player => player.id === item.playerId)) return res.status(400).json({ error: 'Jogador inválido na avaliação.' });
      if (!Array.isArray(item.notes) || item.notes.length !== 5 || item.notes.some(note => !Number.isInteger(Number(note.score)) || Number(note.score) < 0 || Number(note.score) > 10)) return res.status(400).json({ error: 'Cada avaliação precisa de cinco notas de 0 a 10.' });
      item.total = item.notes.reduce((sum, note) => sum + Number(note.score), 0);
      item.objectives = [...(store.objectives[item.playerId] || [])];
    }
    store.evaluations.push(...incoming);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
    return res.json(store);
  } catch (error) { return next(error); }
});

app.use(express.static(frontendDir));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(frontendDir, 'index.html'), error => error && next(error));
  return next();
});

app.listen(port, () => {
  console.log(`VALORANT RACE disponível na porta ${port}`);
  if (!adminPassword) console.warn('Configure ADMIN_PASSWORD no .env para habilitar o login administrativo.');
});
