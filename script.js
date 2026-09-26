// ---------- STATE ----------
let allPrizes = [];
let availablePrizes = [];
let currentPrize = null;
let players = [];              // [{ name, timeline: [] }]
let currentPlayerIndex = 0;
let nextEnabled = false;
let gameStarted = false;

// Setup state
let pendingPlayers = [];

// DOM
const setupScreen = document.getElementById('setupScreen');
const gameArea = document.getElementById('gameArea');
const playerNameInput = document.getElementById('playerNameInput');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const playerListEl = document.getElementById('playerList');
const setupHint = document.getElementById('setupHint');
const startGameBtn = document.getElementById('startGameBtn');

const turnBanner = document.getElementById('turnBanner');
const currentPlayerName = document.getElementById('currentPlayerName');
const citationDisplay = document.getElementById('citationDisplay');
const laureateHint = document.getElementById('laureateHint');
const slotButtonsContainer = document.getElementById('slotButtons');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const feedbackMessage = document.getElementById('feedbackMessage');
const playersTimelines = document.getElementById('playersTimelines');
const globalTooltip = document.getElementById('globalTooltip');

document.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.timeline-card');
  if (!card) return;

  const laureate = card.dataset.laureate;
  const year = card.dataset.year;
  const citation = card.dataset.citation;
  const category = card.dataset.category;
  if (!citation) return;

  globalTooltip.innerHTML = `
    <span class="tooltip-laureate">${escapeHtml(laureate)} · ${formatYear(parseInt(year, 10))} · ${category}</span>
    "${escapeHtml(citation)}"
  `;
  globalTooltip.classList.add('visible');
});

document.addEventListener('mousemove', (e) => {
  const card = e.target.closest('.timeline-card');
  if (!card) return;
  globalTooltip.style.left = e.clientX + 'px';
  globalTooltip.style.top = (e.clientY - 14) + 'px';
});

document.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.timeline-card');
  if (!card) return;
  globalTooltip.classList.remove('visible');
});

// ---------- CSV ----------
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        let parts = [];
        let inQuote = false, current = '';
        for (let char of line) {
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) { parts.push(current.trim()); current = ''; }
            else current += char;
        }
        parts.push(current.trim());
        if (parts.length < 3) continue;
        const year = parseInt(parts[0], 10);
        const laureate = parts[1] || 'Unknown';
        const citation = parts[2] || '';
        if (isNaN(year) || laureate.includes('No prize awarded') || citation.includes('No prize awarded')) continue;
        if (!citation) continue;
        result.push({ year, laureate, citation });
    }
    return result;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatYear(year) {
    return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

// ---------- SETUP ----------
function renderPlayerChips() {
    if (pendingPlayers.length === 0) {
        playerListEl.innerHTML = '';
        setupHint.textContent = 'Add at least one player to begin.';
        startGameBtn.disabled = true;
        return;
    }
    playerListEl.innerHTML = pendingPlayers.map((name, i) => `
        <div class="player-chip">
        <span>${escapeHtml(name)}</span>
        <button class="remove-chip" data-index="${i}" title="Remove">✕</button>
        </div>
    `).join('');
    setupHint.textContent = `${pendingPlayers.length} player${pendingPlayers.length !== 1 ? 's' : ''} ready.`;
    startGameBtn.disabled = false;

    document.querySelectorAll('.remove-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        pendingPlayers.splice(idx, 1);
        renderPlayerChips();
        });
    });
}

function addPendingPlayer() {
    const name = playerNameInput.value.trim();
    if (!name) return;
    if (pendingPlayers.length >= 8) {
        setupHint.textContent = 'Maximum 8 players.';
        return;
    }
    if (pendingPlayers.some(p => p.toLowerCase() === name.toLowerCase())) {
        setupHint.textContent = 'Name already taken.';
        return;
    }
    pendingPlayers.push(name);
    playerNameInput.value = '';
    playerNameInput.focus();
    renderPlayerChips();
}

addPlayerBtn.addEventListener('click', addPendingPlayer);
    playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addPendingPlayer();
    }
});

startGameBtn.addEventListener('click', () => {
    if (pendingPlayers.length === 0) return;
    startGame(pendingPlayers);
});

// ---------- GAME START ----------
function startGame(playerNames) {
  // Prepare the prize pool once
  availablePrizes = shuffleArray([...allPrizes]);

  // Deal one unique starting card to each player
  players = playerNames.map(name => {
    const startingCard = availablePrizes.pop();  // takes from the end of the shuffled array
    return {
      name,
      timeline: startingCard ? [{ ...startingCard }] : []
    };
  });

  currentPlayerIndex = 0;
  gameStarted = true;
  currentPrize = null;
  nextEnabled = false;
  nextBtn.disabled = false;

  setupScreen.style.display = 'none';
  gameArea.classList.add('active');

  renderPlayersTimelines();
  updateTurnBanner();
  citationDisplay.textContent = '—';
  laureateHint.innerHTML = '';
  slotButtonsContainer.innerHTML = '';
  feedbackMessage.textContent = `Click "Next prize" to draw the first citation.`;
  feedbackMessage.className = 'feedback';

  nextBtn.textContent = '▶ Next prize';
}

// ---------- TURN ----------
function currentPlayer() {
    return players[currentPlayerIndex];
}

function updateTurnBanner() {
    currentPlayerName.textContent = currentPlayer().name;
}

function advanceTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateTurnBanner();
}

function renderPlayersTimelines() {
  if (players.length === 0) {
    playersTimelines.innerHTML = '';
    return;
  }

  playersTimelines.innerHTML = players.map((player, pIdx) => {
    const sorted = [...player.timeline].sort((a, b) => a.year - b.year);
    const isCurrent = pIdx === currentPlayerIndex;

    let trackHtml = '';
    if (sorted.length === 0) {
      trackHtml = `<div class="empty-track">No prizes yet…</div>`;
    } else {
      trackHtml = sorted.map((item, i) => {
        const connector = i > 0 ? `<span class="timeline-connector">→</span>` : '';

        // Derive a category class, e.g. "Physics" → "cat-physics",
        // "Physiology or Medicine" → "cat-physiologyormedicine"
        const categoryClass = item.category
          ? 'cat-' + item.category.toLowerCase().replace(/[^a-z]/g, '')
          : '';

        return `${connector}
          <div class="timeline-card ${categoryClass}"
               data-laureate="${escapeHtml(item.laureate)}"
               data-year="${item.year}"
               data-category="${escapeHtml(item.category || '')}"
               data-citation="${escapeHtml(item.citation)}">
            <div class="big-year">${formatYear(item.year)}</div>
            <div class="card-name">${escapeHtml(item.laureate)}</div>
          </div>`;
      }).join('');
    }

    return `
      <div class="player-row ${isCurrent ? 'current-turn' : ''}">
        <div class="player-name-box">
          <div class="name">${escapeHtml(player.name)}</div>
          <div class="count">${player.timeline.length} prize${player.timeline.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="timeline-track">${trackHtml}</div>
      </div>
    `;
  }).join('');
}

// ---------- SLOT BUTTONS ----------
function renderSlotButtons() {
    if (!currentPrize) {
        slotButtonsContainer.innerHTML = '';
        return;
    }

    const player = currentPlayer();
    const sorted = [...player.timeline].sort((a, b) => a.year - b.year);
    const totalSlots = sorted.length + 1;
    let html = '';

    for (let i = 0; i < totalSlots; i++) {
        let label = '';
        if (sorted.length === 0) label = 'Place here';
        else if (i === 0) label = `Before ${formatYear(sorted[0].year)}`;
        else if (i === sorted.length) label = `After ${formatYear(sorted[sorted.length - 1].year)}`;
        else label = `${formatYear(sorted[i - 1].year)} – ${formatYear(sorted[i].year)}`;
        html += `<button class="slot-btn" data-slot-index="${i}">${label}</button>`;
    }

    slotButtonsContainer.innerHTML = html;

    document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
        const slotIndex = parseInt(e.target.dataset.slotIndex, 10);
        handlePlacement(slotIndex);
        });
    });
}

// ---------- CHECK PLACEMENT ----------
function isPlacementCorrect(slotIndex) {
    if (!currentPrize) return false;
    const player = currentPlayer();
    const sorted = [...player.timeline].sort((a, b) => a.year - b.year);
    const prizeYear = currentPrize.year;

    if (sorted.length === 0) return true;
    if (slotIndex === 0) return prizeYear <= sorted[0].year;
    if (slotIndex === sorted.length) return prizeYear >= sorted[sorted.length - 1].year;
    const before = sorted[slotIndex - 1].year;
    const after = sorted[slotIndex].year;
    return prizeYear >= before && prizeYear <= after;
}

// ---------- HANDLE PLACEMENT ----------
function handlePlacement(slotIndex) {
  if (!currentPrize || nextEnabled) return;

  const player = currentPlayer();
  const correct = isPlacementCorrect(slotIndex);

  if (correct) {
    player.timeline.push({ ...currentPrize });

    // Capture the index BEFORE advancing the turn, so the pulse targets the right row.
    const placedPlayerIndex = currentPlayerIndex;
    const guessedName = player.name;
    const placedLaureate = currentPrize.laureate;
    const placedYear = currentPrize.year;

    renderPlayersTimelines();

    // Pulse the newest card after render
    setTimeout(() => {
      const rows = playersTimelines.querySelectorAll('.player-row');
      const row = rows[placedPlayerIndex];
      if (row) {
        const cards = row.querySelectorAll('.timeline-card');
        if (cards.length) cards[cards.length - 1].classList.add('just-added');
      }
    }, 30);

    laureateHint.innerHTML = `<span>${escapeHtml(currentPrize.laureate)} · ${formatYear(currentPrize.year)}</span>`;
    feedbackMessage.textContent = `✅ Correct! ${placedLaureate} (${formatYear(placedYear)}) added to ${guessedName}'s timeline.`;
    feedbackMessage.className = 'feedback success';

    // Advance turn and load next prize after a brief pause
    advanceTurn();
    renderPlayersTimelines();
    updateTurnBanner();

    setTimeout(() => {
      loadNextPrize();
    }, 3000);

  } else {
    const sorted = [...player.timeline].sort((a, b) => a.year - b.year);
    let correctRange = '';
    if (sorted.length === 0) correctRange = 'any position (timeline empty)';
    else {
      let idx = 0;
      while (idx < sorted.length && sorted[idx].year < currentPrize.year) idx++;
      if (idx === 0) correctRange = `before ${formatYear(sorted[0].year)}`;
      else if (idx === sorted.length) correctRange = `after ${formatYear(sorted[sorted.length - 1].year)}`;
      else correctRange = `between ${formatYear(sorted[idx - 1].year)} and ${formatYear(sorted[idx].year)}`;
    }

    const wrongName = player.name;

    // End the turn immediately: advance to the next player, same prize stays.
    advanceTurn();
    renderPlayersTimelines();
    renderSlotButtons();

    feedbackMessage.textContent = `❌ ${wrongName} guessed wrong. It's now ${currentPlayer().name}'s turn.`;
    feedbackMessage.className = 'feedback error';

    // Keep nextEnabled = false, currentPrize unchanged, laureate still hidden.
  }
}

// ---------- LOAD NEXT PRIZE ----------
function loadNextPrize() {
    nextEnabled = false;
    nextBtn.disabled = true;

    if (availablePrizes.length === 0) {
        citationDisplay.textContent = '🎉 All prizes placed! Game complete.';
        laureateHint.innerHTML = '';
        slotButtonsContainer.innerHTML = '';
        feedbackMessage.textContent = 'All prizes have been drawn. Press "New game" to play again.';
        feedbackMessage.className = 'feedback success';
        nextBtn.textContent = '▶ Next prize';
        currentPrize = null;
        return;
    }

    currentPrize = availablePrizes.pop();
    citationDisplay.textContent = `"${currentPrize.citation}"`;
    laureateHint.innerHTML = `<span>???</span> (laureate hidden until placed)`;
    const citationCard = document.querySelector('.citation-card');
    citationCard.classList.remove(
    'cat-physics', 'cat-chemistry',
    'cat-medicine', 'cat-physiologyormedicine',
    'cat-literature', 'cat-peace', 'cat-economics'
    );
    if (currentPrize.category) {
    const cls = currentPrize.category.toLowerCase().replace(/[^a-z]/g, '');
    citationCard.classList.add('cat-' + cls);
    }
    renderSlotButtons();
    updateTurnBanner();

    feedbackMessage.textContent = `Place the citation in the correct spot on ${currentPlayer().name}'s timeline.`;
    feedbackMessage.className = 'feedback';
    nextBtn.textContent = '▶ Next prize';
}

// ---------- NEXT BUTTON LOGIC ----------
nextBtn.addEventListener('click', () => {
    if (!gameStarted) return;

    if (nextEnabled) {
        // placement was made → advance turn, then load next prize
        advanceTurn();
        renderPlayersTimelines();
        loadNextPrize();
    } else if (!currentPrize) {
        // first draw
        if (availablePrizes.length === 0) {
        availablePrizes = shuffleArray([...allPrizes]);
        }
        loadNextPrize();
    } else {
        feedbackMessage.textContent = 'Please place the current citation first.';
        feedbackMessage.className = 'feedback error';
    }
});

// ---------- RESET ----------
resetBtn.addEventListener('click', () => {
    // reset to setup screen
    gameStarted = false;
    pendingPlayers = [];
    players = [];
    currentPlayerIndex = 0;
    currentPrize = null;
    nextEnabled = false;
    availablePrizes = [];

    gameArea.classList.remove('active');
    setupScreen.style.display = 'flex';

    renderPlayerChips();
    playerNameInput.value = '';
    feedbackMessage.textContent = '';
    playerNameInput.focus();
});

// ---------- INIT ----------
// ---------- LOAD CSV ----------
// async function loadPrizes() {
//   try {
//     const response = await fetch('nobel_prizes_physics.csv');
//     if (!response.ok) throw new Error(`HTTP ${response.status}`);
//     const text = await response.text();
//     return parseCSV(text);
//   } catch (err) {
//     console.error('Failed to load CSV:', err);
//     alert('Could not load nobel_prizes.csv. Make sure you are running via a local server.');
//     return [];
//   }
// }

// ---------- INIT ----------
async function init() {
  // allPrizes = await loadPrizes();
    const SOURCES = [
    { category: 'Physics',   csv: window.NOBEL_PHYSICS_CSV },
    { category: 'Chemistry', csv: window.NOBEL_CHEMISTRY_CSV },
    { category: 'Medicine', csv: window.NOBEL_MEDICINE_CSV },

    // add more as you go
    ];

    allPrizes = SOURCES.flatMap(({ category, csv }) =>
    parseCSV(csv).map(prize => ({ ...prize, category }))
    );


  if (allPrizes.length === 0) {
    alert('No valid prize data found.');
    return;
  }
  renderPlayerChips();
  playerNameInput.focus();
}

init();