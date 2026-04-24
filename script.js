// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'geoquiz_leaderboard_v2';
 
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
 
function saveScore(entry) {
  let lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  lb = lb.slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lb));
  return lb;
}
 
// ── Game State ────────────────────────────────────────────────────────────────
let allCountries = [];
let queue = [];
let currentIdx = 0;
let score = 0;
let streak = 0;
let bestStreak = 0;
let countriesAnswered = 0;
let playerName = '';
let feedbackTimer = null;
 
// ── API ───────────────────────────────────────────────────────────────────────
async function fetchCountries() {
  const fields = 'name,region,capital,languages,currencies';
  const res = await fetch(`https://restcountries.com/v3.1/all?fields=${fields}`);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return data
    .map(c => {
      const lang   = c.languages  ? Object.values(c.languages)[0]          : null;
      const curr   = c.currencies ? Object.values(c.currencies)[0]?.name   : null;
      const cap    = c.capital?.[0] ?? null;
      const name   = c.name?.common ?? null;
      const region = c.region ?? 'Unknown';
      if (!lang || !curr || !cap || !name) return null;
      return { name, region, lang, curr, cap };
    })
    .filter(Boolean);
}
 
// ── UI Helpers ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
 
function showFeedback(msg, type) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = `feedback ${type}`;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { el.className = 'feedback'; }, 1800);
}
 
function spawnStreakBurst(n) {
  const el = document.createElement('div');
  el.className = 'streak-burst';
  el.textContent = `🔥 ${n}x`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
 
function updateStats() {
  document.getElementById('stat-score').textContent    = score;
  document.getElementById('stat-streak').textContent   = streak;
  document.getElementById('stat-progress').textContent = `${countriesAnswered}/${allCountries.length}`;
  const pct = allCountries.length ? (countriesAnswered / allCountries.length) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
}
 
function renderQuestion() {
  const c = queue[currentIdx];
  document.getElementById('country-num').textContent  = `Country ${countriesAnswered + 1} of ${allCountries.length}`;
  document.getElementById('region-tag').textContent   = `🌐 ${c.region}`;
  document.getElementById('fact-lang').textContent    = c.lang;
  document.getElementById('fact-curr').textContent    = c.curr;
  document.getElementById('fact-cap').textContent     = c.cap;
  document.getElementById('guess-input').value        = '';
  document.getElementById('feedback').className       = 'feedback';
  document.getElementById('guess-input').focus();
}
 
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}
 
// ── Game Flow ─────────────────────────────────────────────────────────────────
async function startGame() {
  playerName = document.getElementById('player-name').value.trim() || 'Anonymous';
  showScreen('screen-loading');
 
  try {
    if (!allCountries.length) {
      allCountries = await fetchCountries();
    }
 
    queue            = [...allCountries].sort(() => Math.random() - 0.5);
    currentIdx       = 0;
    score            = 0;
    streak           = 0;
    bestStreak       = 0;
    countriesAnswered = 0;
 
    document.getElementById('display-name').textContent = playerName;
    updateStats();
    renderQuestion();
    showScreen('screen-game');
  } catch (e) {
    alert('Failed to load countries. Check your connection and try again.');
    showScreen('screen-entry');
  }
}
 
function submitGuess() {
  const input   = document.getElementById('guess-input');
  const guess   = input.value.trim();
  if (!guess) return;
 
  const current  = queue[currentIdx];
  const correct  = normalize(current.name);
  const userGuess = normalize(guess);
 
  if (userGuess === correct) {
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const multiplier = Math.max(1, streak);
    score += 10 * multiplier;
    countriesAnswered++;
    updateStats();
 
    if (streak > 1 && streak % 3 === 0) spawnStreakBurst(streak);
 
    const suffix = streak > 1
      ? ` — x${streak} streak! +${10 * multiplier}pts`
      : ` +10pts`;
    showFeedback(`✓ Correct! ${current.name}` + suffix, 'correct');
 
    currentIdx++;
    if (currentIdx >= queue.length) {
      setTimeout(() => endGame(true), 900);
    } else {
      setTimeout(renderQuestion, 900);
    }
  } else {
    endGame(false, current.name, guess);
  }
}
 
function endGame(won, correctAnswer = null, userGuess = null) {
  const lb = saveScore({
    name: playerName,
    score,
    countries: countriesAnswered,
    streak: bestStreak,
    date: Date.now()
  });
 
  document.getElementById('gameover-icon').textContent  = won ? '🏆' : '💀';
  document.getElementById('gameover-title').textContent = won ? 'You Won!' : 'Game Over';
  document.getElementById('gameover-msg').textContent   = won
    ? `Incredible! You named all ${allCountries.length} countries!`
    : correctAnswer
      ? `You guessed "${userGuess}" — the answer was ${correctAnswer}.`
      : 'Better luck next time!';
 
  document.getElementById('final-score').textContent    = score;
  document.getElementById('final-countries').textContent = countriesAnswered;
  document.getElementById('final-streak').textContent   = bestStreak;
 
  renderLeaderboard(lb);
  showScreen('screen-gameover');
}
 
function renderLeaderboard(lb) {
  const ul = document.getElementById('leaderboard');
  if (!lb.length) {
    ul.innerHTML = '<div class="lb-empty">No scores yet — you\'re first!</div>';
    return;
  }
  const rankClass  = i => i === 0 ? 'gold'  : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankSymbol = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
 
  ul.innerHTML = lb.map((e, i) => {
    const isNew = e.name === playerName && e.score === score;
    return `
      <li class="lb-item ${isNew ? 'highlight' : ''}">
        <span class="lb-rank ${rankClass(i)}">${rankSymbol(i)}</span>
        <span class="lb-name">${e.name}${isNew ? ' ←' : ''}</span>
        <span class="lb-score-val">${e.score}</span>
        <span class="lb-meta">${e.countries} countries</span>
      </li>`;
  }).join('');
}
 
function playAgain() {
  showScreen('screen-loading');
  startGame();
}
 
function goHome() {
  document.getElementById('player-name').value = playerName;
  showScreen('screen-entry');
}
 
// ── Keyboard Support ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const game  = document.getElementById('screen-game');
  const entry = document.getElementById('screen-entry');
  if (game.classList.contains('active'))  submitGuess();
  else if (entry.classList.contains('active')) startGame();
});
