import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true, waiting: queue.length }));
const server = createServer(app);
const wss = new WebSocketServer({ server });
const queue = [];
const matches = new Map();

const arena = { width: 960, height: 540 };
const freshPlayer = (id, slot) => ({ id, slot, x: slot ? 780 : 180, y: 265, hp: 100, score: 0, facing: slot ? -1 : 1, attack: 0, dash: 0, attackCd: 0, boltCd: 0, shield: 0, shieldCd: 0, input: {} });
const send = (ws, body) => ws.readyState === 1 && ws.send(JSON.stringify(body));
const broadcast = (match, body) => match.clients.forEach(ws => send(ws, body));

function beginMatch(a, b) {
  const id = randomUUID();
  const match = { id, clients: [a, b], players: [freshPlayer(a.id, 0), freshPlayer(b.id, 1)], bolts: [], over: false };
  a.matchId = b.matchId = id;
  matches.set(id, match);
  match.clients.forEach((ws, slot) => send(ws, { type: 'matched', slot, rival: slot ? a.nickname : b.nickname }));
}
function removeFromQueue(ws) { const i = queue.indexOf(ws); if (i !== -1) queue.splice(i, 1); }
function resetRound(match) { match.bolts = []; match.over = false; match.players.forEach((p, slot) => Object.assign(p, freshPlayer(p.id, slot), { score: p.score })); }
function hit(match, target, amount, source) { if (target.shield > 0) amount = Math.ceil(amount * .35); target.hp = Math.max(0, target.hp - amount); if (target.hp === 0 && !match.over) { match.over = true; source.score++; const matchWon = source.score >= 3; broadcast(match, { type: 'roundOver', winner: source.slot, matchWon }); setTimeout(() => { if (matchWon) { match.players.forEach(p => p.score = 0); } resetRound(match); }, 2200); } }
function update(match, dt) {
  if (match.over) return;
  for (const p of match.players) {
    for (const key of ['attack', 'dash', 'attackCd', 'boltCd', 'shield', 'shieldCd']) p[key] = Math.max(0, p[key] - dt);
    const i = p.input || {}; let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0), dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    if (dx || dy) { const l = Math.hypot(dx, dy); const speed = p.dash > 0 ? 640 : 220; p.x = Math.max(32, Math.min(928, p.x + dx / l * speed * dt)); p.y = Math.max(72, Math.min(466, p.y + dy / l * speed * dt)); if (dx) p.facing = Math.sign(dx); }
    if (i.dash && p.attackCd === 0) { p.dash = .16; p.attackCd = .75; }
    if (i.shield && p.shieldCd === 0) { p.shield = 1.25; p.shieldCd = 4.4; }
    const opponent = match.players[1 - p.slot];
    if (i.attack && p.attackCd === 0) { p.attack = .17; p.attackCd = .42; if (Math.hypot(opponent.x - p.x, opponent.y - p.y) < 82 && Math.sign(opponent.x - p.x) === p.facing) hit(match, opponent, 16, p); }
    if (i.bolt && p.boltCd === 0) { p.boltCd = .95; match.bolts.push({ x: p.x + p.facing * 28, y: p.y - 5, vx: p.facing * 500, owner: p.slot, life: 1.8 }); }
  }
  for (let i = match.bolts.length - 1; i >= 0; i--) { const bolt = match.bolts[i], target = match.players[1 - bolt.owner], owner = match.players[bolt.owner]; bolt.x += bolt.vx * dt; bolt.life -= dt; if (Math.hypot(bolt.x - target.x, bolt.y - target.y) < 26) { hit(match, target, 12, owner); match.bolts.splice(i, 1); } else if (bolt.life <= 0 || bolt.x < 0 || bolt.x > arena.width) match.bolts.splice(i, 1); }
  broadcast(match, { type: 'state', players: match.players, bolts: match.bolts });
}
wss.on('connection', ws => {
  ws.id = randomUUID(); ws.nickname = 'Wanderer';
  send(ws, { type: 'welcome' });
  ws.on('message', raw => { try { const msg = JSON.parse(raw); if (msg.type === 'findMatch') { ws.nickname = String(msg.nickname || 'Wanderer').slice(0, 14); removeFromQueue(ws); const rival = queue.shift(); if (rival && rival.readyState === rival.OPEN) beginMatch(rival, ws); else { queue.push(ws); send(ws, { type: 'waiting' }); } } if (msg.type === 'input' && ws.matchId) { const match = matches.get(ws.matchId); const player = match?.players.find(p => p.id === ws.id); if (player) player.input = msg.input || {}; } } catch {} });
  ws.on('close', () => { removeFromQueue(ws); if (ws.matchId) { const match = matches.get(ws.matchId); if (match) { broadcast(match, { type: 'opponentLeft' }); matches.delete(ws.matchId); } } });
});
setInterval(() => matches.forEach(match => update(match, 1 / 30)), 1000 / 30);
server.listen(process.env.PORT || 3000, () => console.log('Moonmoss Arena listening'));
