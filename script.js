const TARGET = 5;
const TIMING = {
  shuffle: 260, // computer card jiggles before flipping
  flip: 340, // flip duration, then the round resolves
  next: 800, // pause before the next round (clicking a card skips it)
};
const COLORS = {
  gold: ["#e8b84a", "#f6d98a", "#fbf3dc", "#c9962e"],
  red: ["#d65a43", "#f08a6f", "#a63a28"],
  puff: ["#f6efdc", "#a9c7b8"],
  confetti: ["#e8b84a", "#f6efdc", "#d65a43", "#3f6e9e", "#8fd3a8"],
};

const INK = "#2b2622";
const MOVES = {
  rock: {
    letter: "R",
    beats: "scissors",
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="53" rx="21" ry="3.5" fill="#000" opacity=".12"/>
      <path d="M12 46 C9 38 12 28 19 22 C24 16 34 13 42 17 C50 21 55 30 53 39 C52 46 46 50 36 50 C26 51 15 50 12 46 Z"
        fill="#b9ab97" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M20 28 C23 23 28 20 34 19.5" fill="none" stroke="#e6dccb" stroke-width="3" stroke-linecap="round"/>
      <path d="M36 50 C35 44 38 39 44 36 C47 35 50 36 53 38" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="26" cy="38" r="1.3" fill="${INK}" opacity=".5"/>
      <circle cx="31" cy="43" r="1" fill="${INK}" opacity=".5"/>
      <circle cx="21" cy="43" r="1" fill="${INK}" opacity=".5"/>
    </svg>`,
  },
  paper: {
    letter: "P",
    beats: "rock",
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="33" cy="57" rx="17" ry="3" fill="#000" opacity=".12"/>
      <g transform="rotate(-6 32 32)">
        <path d="M17 9 H40 L49 18 V55 H17 Z" fill="#fffdf6" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M40 9 V18 H49" fill="#e9e3d3" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M23 26 H43 M23 32 H43 M23 38 H43 M23 44 H35" stroke="#7da2c9" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  scissors: {
    letter: "S",
    beats: "paper",
    svg: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M23 40 L45 7 L29 39 Z" fill="#dfe5ea" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M41 40 L19 7 L35 39 Z" fill="#dfe5ea" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="32" cy="29" r="2.4" fill="${INK}"/>
      <circle cx="22" cy="47" r="7.5" fill="none" stroke="${INK}" stroke-width="7"/>
      <circle cx="22" cy="47" r="7.5" fill="none" stroke="#d65a43" stroke-width="3.6"/>
      <circle cx="42" cy="47" r="7.5" fill="none" stroke="${INK}" stroke-width="7"/>
      <circle cx="42" cy="47" r="7.5" fill="none" stroke="#d65a43" stroke-width="3.6"/>
    </svg>`,
  },
};

const $ = (id) => document.getElementById(id);
const table = $("table");
const hand = $("hand");
const cpuSlot = $("cpu-slot");
const flipper = $("flipper");
const cpuFront = $("cpu-front");
const statusEl = $("status");
const overlay = $("overlay");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let score = { you: 0, cpu: 0 };
let phase = "idle"; // idle | revealing | result | over
let roundId = 0; // bumps on reset so stale timers from an earlier round are ignored
let nextTimer = null;

/* ---------- Building ---------- */

function cardFace(move) {
  const m = MOVES[move];
  return `
    <span class="corner">${m.letter}</span>
    <span class="art">${m.svg}<span class="name">${move}</span></span>
    <span class="corner corner--br">${m.letter}</span>`;
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

function buildPips() {
  for (const who of ["you", "cpu"]) {
    $(`${who}-pips`).innerHTML = '<span class="pip-dot"></span>'.repeat(TARGET);
  }
  $("target").textContent = TARGET;
}

function dealHand() {
  hand.querySelectorAll(".card").forEach((card) => {
    restartClass(card, "deal");
    card.addEventListener("animationend", () => card.classList.remove("deal"), { once: true });
  });
}

/* ---------- Game flow ---------- */

function play(move) {
  if (phase === "over" || phase === "revealing") return;
  if (phase === "result") resetRound(true); // skip the pause

  phase = "revealing";
  const id = roundId;
  const yourSlot = hand.querySelector(`[data-move="${move}"]`);
  hand.querySelectorAll(".slot").forEach((s) => {
    s.disabled = true;
    s.classList.add(s === yourSlot ? "picked" : "dim");
  });

  const cpu = randomMove();
  setStatus("…");
  restartClass(cpuSlot, "shuffling");

  after(TIMING.shuffle, id, () => {
    cpuSlot.classList.remove("shuffling");
    cpuFront.dataset.move = cpu;
    cpuFront.innerHTML = cardFace(cpu);
    cpuSlot.classList.add("flipped");
    after(TIMING.flip, id, () => resolve(move, cpu, yourSlot));
  });
}

function resolve(move, cpu, yourSlot) {
  const id = roundId;
  const result = outcome(move, cpu);

  if (result === "win") {
    score.you++;
    yourSlot.classList.add("win-glow");
    cpuSlot.classList.add("lose-shake");
    burst(yourSlot, { colors: COLORS.gold, count: 36, speed: 7 });
    bumpScore("you");
    quake();
    setStatus(`${cap(move)} beats ${cpu}!`, "win");
  } else if (result === "lose") {
    score.cpu++;
    yourSlot.classList.add("lose-shake");
    cpuSlot.classList.add("win-glow");
    burst(cpuSlot, { colors: COLORS.red, count: 28, speed: 6 });
    bumpScore("cpu");
    quake();
    setStatus(`${cap(cpu)} beats ${move}`, "lose");
  } else {
    yourSlot.classList.add("draw-wobble");
    cpuSlot.classList.add("draw-wobble");
    burst(yourSlot, { colors: COLORS.puff, count: 10, speed: 2.5, gravity: 0.02, size: [3, 6] });
    burst(cpuSlot, { colors: COLORS.puff, count: 10, speed: 2.5, gravity: 0.02, size: [3, 6] });
    setStatus("Draw");
  }

  if (score.you >= TARGET || score.cpu >= TARGET) {
    phase = "over";
    after(450, id, endGame);
    return;
  }

  phase = "result";
  hand.querySelectorAll(".slot").forEach((s) => (s.disabled = false)); // let a click skip the pause
  nextTimer = after(TIMING.next, id, () => resetRound(false));
}

function resetRound(instant) {
  clearTimeout(nextTimer);
  if (instant) {
    flipper.style.transition = "none";
    cpuSlot.classList.remove("flipped");
    void flipper.offsetWidth; // commit the un-flipped state before restoring the transition
    flipper.style.transition = "";
  } else {
    cpuSlot.classList.remove("flipped");
  }
  cpuSlot.classList.remove("win-glow", "lose-shake", "draw-wobble", "shuffling");
  hand.querySelectorAll(".slot").forEach((s) => {
    s.disabled = false;
    s.classList.remove("picked", "dim", "win-glow", "lose-shake", "draw-wobble");
  });
  setStatus("Your move");
  phase = "idle";
}

function endGame() {
  const youWon = score.you > score.cpu;
  const title = $("over-title");
  title.textContent = youWon ? "You win!" : "Computer wins";
  title.className = "panel__title " + (youWon ? "win" : "lose");
  $("over-score").textContent = `${score.you} – ${score.cpu}`;
  overlay.hidden = false;
  $("again").focus();
  if (youWon) celebrate();
  else burst(cpuSlot, { colors: COLORS.red, count: 50, speed: 8 });
}

function newGame() {
  roundId++;
  score = { you: 0, cpu: 0 };
  overlay.hidden = true;
  renderScore();
  resetRound(true);
  dealHand();
}

/* ---------- Helpers ---------- */

function randomMove() {
  const moves = Object.keys(MOVES);
  return moves[Math.floor(Math.random() * moves.length)];
}

function outcome(you, cpu) {
  if (you === cpu) return "draw";
  return MOVES[you].beats === cpu ? "win" : "lose";
}

// setTimeout that does nothing if a new game started in the meantime
function after(ms, id, fn) {
  return setTimeout(() => id === roundId && fn(), ms);
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
  restartClass(table, "quake");
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
  if (reducedMotion) return;
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
$("again").addEventListener("click", newGame);
addEventListener("resize", resizeCanvas);

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const move = Object.keys(MOVES).find((m) => MOVES[m].letter.toLowerCase() === key);
  if (move) play(move);
  else if (key === "n") newGame();
});

resizeCanvas();
buildPips();
buildHand();
renderScore();
dealHand();
