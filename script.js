const TARGET = 5;
const REVEAL_DELAY = 550; // ms for the computer card to flip
const NEXT_ROUND_DELAY = 1400;

// Each card's "pip" is a simple shape: rock = circle, paper = square, scissors = cross.
const MOVES = {
  rock: {
    letter: "R",
    beats: "scissors",
    svg: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="currentColor"/></svg>',
  },
  paper: {
    letter: "P",
    beats: "rock",
    svg: '<svg viewBox="0 0 40 40"><rect x="7" y="7" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  },
  scissors: {
    letter: "S",
    beats: "paper",
    svg: '<svg viewBox="0 0 40 40"><path d="M8 8 L32 32 M32 8 L8 32" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  },
};

const hand = document.getElementById("hand");
const cpuCard = document.getElementById("cpu-card");
const cpuFront = document.getElementById("cpu-front");
const statusEl = document.getElementById("status");
const youScoreEl = document.getElementById("you-score");
const cpuScoreEl = document.getElementById("cpu-score");
document.getElementById("target").textContent = TARGET;

let score = { you: 0, cpu: 0 };
let busy = false;
let gameOver = false;
let roundId = 0; // bumps on new game so stale timers from a previous round are ignored

function cardFace(move) {
  const m = MOVES[move];
  return `
    <span class="corner corner--tl">${m.letter}</span>
    <span class="pip">${m.svg}</span>
    <span class="name">${move}</span>
    <span class="corner corner--br">${m.letter}</span>`;
}

function buildHand() {
  for (const move of Object.keys(MOVES)) {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.dataset.move = move;
    btn.setAttribute("aria-label", `Play ${move}`);
    btn.innerHTML = cardFace(move);
    btn.addEventListener("click", () => play(move));
    hand.appendChild(btn);
  }
}

function cpuPick() {
  const moves = Object.keys(MOVES);
  return moves[Math.floor(Math.random() * moves.length)];
}

function outcome(you, cpu) {
  if (you === cpu) return "draw";
  return MOVES[you].beats === cpu ? "win" : "lose";
}

function setStatus(text, cls = "") {
  statusEl.textContent = text;
  statusEl.className = "status " + cls;
}

function play(move) {
  if (busy || gameOver) return;
  busy = true;
  const id = roundId;

  const yourCard = hand.querySelector(`[data-move="${move}"]`);
  hand.classList.add("locked");
  yourCard.classList.add("picked");
  hand.querySelectorAll(".card").forEach((c) => (c.disabled = true));

  const cpu = cpuPick();
  cpuFront.innerHTML = cardFace(cpu);
  cpuCard.classList.add("flipped");
  setStatus("…");

  setTimeout(() => {
    if (id !== roundId) return;
    const result = outcome(move, cpu);
    if (result === "win") {
      score.you++;
      yourCard.classList.add("win");
      cpuFront.classList.add("lose");
      setStatus(`${cap(move)} beats ${cpu}`, "win");
    } else if (result === "lose") {
      score.cpu++;
      yourCard.classList.add("lose");
      cpuFront.classList.add("win");
      setStatus(`${cap(cpu)} beats ${move}`, "lose");
    } else {
      setStatus("Draw");
    }
    renderScore();

    if (score.you >= TARGET || score.cpu >= TARGET) {
      gameOver = true;
      const youWon = score.you > score.cpu;
      setStatus(youWon ? "You win the game" : "The computer wins the game", youWon ? "win" : "lose");
      busy = false;
      return;
    }

    setTimeout(() => id === roundId && resetRound(), NEXT_ROUND_DELAY);
  }, REVEAL_DELAY);
}

function resetRound() {
  cpuCard.classList.remove("flipped");
  cpuFront.classList.remove("win", "lose");
  hand.classList.remove("locked");
  hand.querySelectorAll(".card").forEach((c) => {
    c.disabled = false;
    c.classList.remove("picked", "win", "lose");
  });
  setStatus("Choose a card");
  busy = false;
}

function renderScore() {
  youScoreEl.textContent = score.you;
  cpuScoreEl.textContent = score.cpu;
}

function newGame() {
  roundId++;
  score = { you: 0, cpu: 0 };
  gameOver = false;
  renderScore();
  resetRound();
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

document.getElementById("reset").addEventListener("click", newGame);

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const move = Object.keys(MOVES).find((m) => MOVES[m].letter.toLowerCase() === key);
  if (move) play(move);
  else if (key === "n") newGame();
});

buildHand();
