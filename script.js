const TARGETS = [3, 5, 7];
const TIMING = {
  hop: 120, // computer hovers over each face-down card
  fly: 320, // chosen card slides onto the table
  playFly: 260, // your card slides onto the table
  flip: 340, // computer card flips, then the round resolves
  next: 800, // pause before the next round (clicking a card skips it)
  collect: 180, // played card is swept off the table
};
const FAN = [
  { fx: -36, fy: 8, r: -12 },
  { fx: 0, fy: 0, r: 0 },
  { fx: 36, fy: 8, r: 12 },
];
const COLORS = {
  gold: ["#e8b84a", "#f6d98a", "#fbf3dc", "#c9962e"],
  red: ["#d65a43", "#f08a6f", "#a63a28"],
  puff: ["#f6efdc", "#a9c7b8"],
  confetti: ["#e8b84a", "#f6efdc", "#d65a43", "#a8232a", "#1d1a17"],
};

const MOVES = {
  rock: { letter: "R", beats: "scissors", verb: "breaks" },
  paper: { letter: "P", beats: "rock", verb: "covers" },
  scissors: { letter: "S", beats: "paper", verb: "cut" },
};

const $ = (id) => document.getElementById(id);
const table = $("table");
const hand = $("hand");
const cpuHand = $("cpu-hand");
const cpuSpot = $("cpu-spot");
const youSpot = $("you-spot");
const cpuSlot = $("cpu-slot");
const flipper = $("flipper");
const cpuFront = $("cpu-front");
const statusEl = $("status");
const overlay = $("overlay");
const settingsEl = $("settings");
const settingsBtn = $("settings-btn");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let target = TARGETS.includes(load("rps.target", 5)) ? load("rps.target", 5) : 5;
let effects = load("rps.effects", true) !== false;
let score = { you: 0, cpu: 0 };
let phase = "choosing"; // choosing | ready | revealing | result | over
let token = 0; // bumps every round / new game so stale timers are ignored
let cpuMove = null; // committed while the computer's card is still face down
let queued = null; // a move you clicked while the computer was still choosing
let pickedSlot = null;

/* ---------- Building ---------- */

function cardFace(move) {
  const m = MOVES[move];
  const index = `<b>${m.letter}</b><svg viewBox="0 0 20 20"><use href="#suit-${move}"/></svg>`;
  return `
    <span class="index">${index}</span>
    <span class="frame">
      <svg class="art" viewBox="0 0 80 80"><use href="#art-${move}" width="80" height="80"/></svg>
      <span class="name">${move}</span>
      <span class="verb">${m.verb} ${m.beats}</span>
    </span>
    <span class="index index--br">${index}</span>`;
}

function buildHand() {
  Object.keys(MOVES).forEach((move, i) => {
    const slot = document.createElement("button");
    slot.className = "slot";
    slot.type = "button";
    slot.dataset.move = move;
    slot.setAttribute("aria-label", `Play ${move}`);
    slot.innerHTML = `<div class="card" data-move="${move}" style="--i:${i}">${cardFace(move)}</div>`;
    slot.addEventListener("click", () => play(move));
    hand.appendChild(slot);
  });
}

function buildFan() {
  FAN.forEach((_, i) => {
    const el = document.createElement("div");
    el.className = "fan-card";
    el.style.setProperty("--i", i);
    el.innerHTML = '<div class="card card--back"></div>';
    cpuHand.appendChild(el);
    restFan(el, i);
  });
}

function restFan(el, i) {
  el.style.setProperty("--fx", `${FAN[i].fx}px`);
  el.style.setProperty("--fy", `${FAN[i].fy}px`);
  el.style.setProperty("--r", `${FAN[i].r}deg`);
  el.style.removeProperty("--s");
}

function buildPips() {
  for (const who of ["you", "cpu"]) {
    $(`${who}-pips`).innerHTML = '<span class="pip-dot"></span>'.repeat(target);
  }
  $("target").textContent = target;
}

function deal() {
  for (const el of [...hand.querySelectorAll(".card"), ...cpuHand.children]) {
    restartClass(el, "deal");
    el.addEventListener("animationend", () => el.classList.remove("deal"), { once: true });
  }
}

/* ---------- Game flow ---------- */

// The computer commits to a face-down card before you choose.
function startRound(delay = 0) {
  const t = ++token;
  phase = "choosing";
  collectCpuCard();
  resetHand();
  if (queued) markPicked(queued);
  setStatus("The computer is choosing…", "wait");

  cpuMove = randomMove();
  const fan = [...cpuHand.children];
  fan.forEach((c) => c.classList.remove("gone", "lift"));
  const pick = (Math.random() * fan.length) | 0;
  const hops = [];
  while (hops.length < 2) {
    const i = (Math.random() * fan.length) | 0;
    if (i !== hops[hops.length - 1] && !(hops.length === 1 && i === pick)) hops.push(i);
  }
  hops.push(pick);

  let n = 0;
  const hop = () => {
    fan.forEach((c) => c.classList.remove("lift"));
    if (n < hops.length) {
      fan[hops[n++]].classList.add("lift");
      after(TIMING.hop, t, hop);
    } else {
      dealToSpot(fan[pick], pick, t);
    }
  };
  after(delay, t, hop);
}

function dealToSpot(card, i, t) {
  const dx = cpuSpot.offsetLeft - (cpuHand.offsetLeft + card.offsetLeft);
  const dy = cpuSpot.offsetTop - (cpuHand.offsetTop + card.offsetTop);
  card.classList.add("flying");
  card.style.setProperty("--fx", `${dx}px`);
  card.style.setProperty("--fy", `${dy}px`);
  card.style.setProperty("--r", "0deg");
  card.style.setProperty("--s", "1");

  after(TIMING.fly, t, () => {
    card.classList.add("gone");
    card.classList.remove("flying");
    restFan(card, i);
    cpuSlot.classList.add("dealt");
    restartClass(cpuSlot, "land");
    const r = cpuSpot.getBoundingClientRect();
    burst(cpuSpot, { colors: COLORS.puff, count: 8, speed: 2, gravity: 0, size: [2, 4], from: { x: r.left + r.width / 2, y: r.bottom, angle: -Math.PI / 2, spread: Math.PI } });

    phase = "ready";
    if (queued) {
      const m = queued;
      queued = null;
      play(m);
    } else {
      setStatus("Your move");
    }
  });
}

function play(move) {
  if (phase === "over" || phase === "revealing") return;
  if (phase === "choosing") {
    queued = move;
    markPicked(move);
    return;
  }
  if (phase === "result") {
    queued = move;
    startRound();
    return;
  }

  phase = "revealing";
  const t = token;
  hand.classList.add("locked");
  markPicked(move);
  pickedSlot = hand.querySelector(`[data-move="${move}"]`);
  sendToSpot(pickedSlot, true);
  setStatus("…", "wait");

  after(TIMING.playFly, t, () => {
    cpuFront.dataset.move = cpuMove;
    cpuFront.innerHTML = cardFace(cpuMove);
    cpuSlot.classList.add("flipped");
    after(TIMING.flip, t, () => resolve(move, cpuMove, pickedSlot));
  });
}

function resolve(move, cpu, yourSlot) {
  const t = token;
  const result = outcome(move, cpu);

  if (result === "win") {
    score.you++;
    yourSlot.classList.add("win-glow");
    cpuSlot.classList.add("lose-shake");
    burst(youSpot, { colors: COLORS.gold, count: 36, speed: 7 });
    bumpScore("you");
    quake();
    setStatus(`${cap(move)} ${MOVES[move].verb} ${cpu}!`, "win");
  } else if (result === "lose") {
    score.cpu++;
    yourSlot.classList.add("lose-shake");
    cpuSlot.classList.add("win-glow");
    burst(cpuSlot, { colors: COLORS.red, count: 28, speed: 6 });
    bumpScore("cpu");
    quake();
    setStatus(`${cap(cpu)} ${MOVES[cpu].verb} ${move}`, "lose");
  } else {
    yourSlot.classList.add("draw-wobble");
    cpuSlot.classList.add("draw-wobble");
    for (const el of [youSpot, cpuSpot]) burst(el, { colors: COLORS.puff, count: 10, speed: 2.5, gravity: 0.02, size: [3, 6] });
    setStatus("Draw");
  }

  if (score.you >= target || score.cpu >= target) {
    phase = "over";
    after(450, t, endGame);
    return;
  }

  phase = "result";
  hand.classList.remove("locked"); // clicking a card now skips the pause
  after(TIMING.next, t, () => startRound());
}

function collectCpuCard() {
  if (!cpuSlot.classList.contains("dealt")) return;
  restartClass(cpuSlot, "collect");
  setTimeout(() => {
    flipper.style.transition = "none";
    cpuSlot.className = "slot slot--cpu";
    void flipper.offsetWidth; // commit the un-flipped state before restoring the transition
    flipper.style.transition = "";
  }, TIMING.collect);
}

function resetHand() {
  hand.classList.remove("locked");
  hand.querySelectorAll(".slot").forEach((s) => {
    s.classList.remove("picked", "dim", "win-glow", "lose-shake", "draw-wobble");
    if (s.style.transform) {
      s.style.transition = "transform 0.25s ease";
      s.style.transform = "";
      setTimeout(() => (s.style.transition = ""), 260);
    }
  });
  pickedSlot = null;
}

function markPicked(move) {
  hand.querySelectorAll(".slot").forEach((s) => {
    s.classList.toggle("picked", s.dataset.move === move);
    s.classList.toggle("dim", s.dataset.move !== move);
  });
}

function sendToSpot(slot, animate) {
  const dx = youSpot.offsetLeft - slot.offsetLeft;
  const dy = youSpot.offsetTop - slot.offsetTop;
  slot.style.transition = animate ? `transform ${TIMING.playFly}ms cubic-bezier(.2, .9, .3, 1.1)` : "none";
  slot.style.transform = `translate(${dx}px, ${dy}px)`;
}

function endGame() {
  const youWon = score.you > score.cpu;
  const title = $("over-title");
  title.textContent = youWon ? "You win!" : "The computer wins";
  title.className = "panel__title " + (youWon ? "win" : "lose");
  $("over-score").textContent = `${score.you} – ${score.cpu}`;
  overlay.hidden = false;
  $("again").focus();
  if (youWon) celebrate();
  else burst(cpuSlot, { colors: COLORS.red, count: 50, speed: 8 });
}

function newGame() {
  score = { you: 0, cpu: 0 };
  queued = null;
  overlay.hidden = true;
  buildPips();
  renderScore();
  token++;
  flipper.style.transition = "none";
  cpuSlot.className = "slot slot--cpu";
  void flipper.offsetWidth;
  flipper.style.transition = "";
  resetHand();
  deal();
  startRound(350);
}

/* ---------- Settings ---------- */

function toggleSettings(open = settingsEl.hidden) {
  settingsEl.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", open);
}

function renderSettings() {
  document.querySelectorAll("#target-seg button").forEach((b) => b.classList.toggle("on", +b.dataset.target === target));
  $("fx-toggle").setAttribute("aria-checked", effects);
}

$("target-seg").addEventListener("click", (e) => {
  const value = +e.target.dataset.target;
  if (!value || value === target) return;
  target = value;
  save("rps.target", target);
  renderSettings();
  newGame();
});

$("fx-toggle").addEventListener("click", () => {
  effects = !effects;
  save("rps.effects", effects);
  renderSettings();
});

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettings();
});
document.addEventListener("click", (e) => {
  if (!settingsEl.hidden && !settingsEl.contains(e.target)) toggleSettings(false);
});

/* ---------- Helpers ---------- */

function randomMove() {
  const moves = Object.keys(MOVES);
  return moves[Math.floor(Math.random() * moves.length)];
}

function outcome(you, cpu) {
  if (you === cpu) return "draw";
  return MOVES[you].beats === cpu ? "win" : "lose";
}

// setTimeout that does nothing if a newer round or game started in the meantime
function after(ms, t, fn) {
  return setTimeout(() => t === token && fn(), ms);
}

function restartClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // reflow so the animation replays
  el.classList.add(cls);
}

function setStatus(text, cls = "") {
  statusEl.textContent = text;
  statusEl.className = "status " + cls;
  restartClass(statusEl, "pop");
}

function renderScore() {
  for (const who of ["you", "cpu"]) {
    $(`${who}-score`).textContent = score[who];
    $(`${who}-pips`).querySelectorAll(".pip-dot").forEach((dot, i) => {
      dot.classList.toggle("on", i < score[who]);
      dot.classList.remove("fresh");
    });
  }
}

function bumpScore(who) {
  renderScore();
  restartClass($(`${who}-score`), "bump");
  const dot = $(`${who}-pips`).children[score[who] - 1];
  if (dot) restartClass(dot, "fresh");
}

function quake() {
  if (effects) restartClass(table, "quake");
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/* ---------- Particles ---------- */

const canvas = $("fx");
const ctx = canvas.getContext("2d");
let particles = [];
let animating = false;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst(el, { colors, count = 24, speed = 6, gravity = 0.22, size = [4, 8], from } = {}) {
  if (reducedMotion || !effects) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const angle = from ? from.angle + (Math.random() - 0.5) * from.spread : Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    // card bursts start on the card's edge and fly outward, so they don't cover the drawing
    const x = from ? from.x : r.left + r.width / 2 + (Math.cos(angle) * r.width) / 2;
    const y = from ? from.y : r.top + r.height / 2 + (Math.sin(angle) * r.height) / 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - (from ? 0 : speed * 0.35),
      g: gravity,
      w: size[0] + Math.random() * (size[1] - size[0]),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.4,
      life: 0,
      ttl: 45 + Math.random() * 35,
    });
  }
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}

function celebrate() {
  const h = innerHeight;
  const opts = { colors: COLORS.confetti, count: 70, speed: 15, gravity: 0.3, size: [5, 10] };
  burst(document.body, { ...opts, from: { x: 0, y: h, angle: -Math.PI / 3, spread: 0.7 } });
  burst(document.body, { ...opts, from: { x: innerWidth, y: h, angle: (-2 * Math.PI) / 3, spread: 0.7 } });
  setTimeout(() => burst(document.body, { ...opts, count: 50, from: { x: innerWidth / 2, y: h, angle: -Math.PI / 2, spread: 0.9 } }), 180);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life < p.ttl);
  for (const p of particles) {
    p.life++;
    p.vx *= 0.97;
    p.vy = p.vy * 0.97 + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.globalAlpha = Math.min(1, 1.6 * (1 - p.life / p.ttl));
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.round) {
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (particles.length) requestAnimationFrame(tick);
  else animating = false;
}

/* ---------- Wiring ---------- */

$("reset").addEventListener("click", newGame);
$("settings-new").addEventListener("click", () => {
  toggleSettings(false);
  newGame();
});
$("again").addEventListener("click", newGame);

addEventListener("resize", () => {
  resizeCanvas();
  if (pickedSlot) sendToSpot(pickedSlot, false); // keep your played card on its spot
});

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "escape") return toggleSettings(false);
  const move = Object.keys(MOVES).find((m) => MOVES[m].letter.toLowerCase() === key);
  if (move) play(move);
  else if (key === "n") newGame();
});

resizeCanvas();
buildHand();
buildFan();
renderSettings();
newGame();
