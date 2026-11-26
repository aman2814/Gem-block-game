(function (global) {
  'use strict';

  const GRID_SIZE = 8;
  const STORAGE_BEST_KEY = 'gemblock_best_score';
  const STORAGE_STATE_KEY = 'gemblock_saved_state';
  const STORAGE_STATS_KEY = 'gemblock_stats';
  const CELL_PAD_RATIO = 0.032;
  const DRAG_SHADOW_PAD = 18;

  // 7 Vibrant Jeweled Color Palettes matching sculpted close-up craftsmanship
  const GEM_COLORS = [
    {
      id: 'cyan',
      crownBright: '#B8FCFF',
      facetLight: '#52EEFF',
      body: '#10CBFA',
      facetMid: '#009EE3',
      pavilion: '#0064B5',
      edgeDeep: '#003875',
      glow: '#54F2FF',
    },
    {
      id: 'emerald',
      crownBright: '#C2FF9E',
      facetLight: '#5CF842',
      body: '#22DF1A',
      facetMid: '#0EB415',
      pavilion: '#047A12',
      edgeDeep: '#024709',
      glow: '#78FF66',
    },
    {
      id: 'ruby',
      crownBright: '#FFC4ED',
      facetLight: '#FF6EC9',
      body: '#FF2FA7',
      facetMid: '#DA1284',
      pavilion: '#980558',
      edgeDeep: '#590233',
      glow: '#FF86D0',
    },
    {
      id: 'amber',
      crownBright: '#FFF5B0',
      facetLight: '#FFD53E',
      body: '#FFAE08',
      facetMid: '#DF7700',
      pavilion: '#A14600',
      edgeDeep: '#5E2400',
      glow: '#FFD65C',
    },
    {
      id: 'sapphire',
      crownBright: '#B8D4FF',
      facetLight: '#5A92FF',
      body: '#2A5FF8',
      facetMid: '#123AD1',
      pavilion: '#081E8B',
      edgeDeep: '#030E52',
      glow: '#7AA3FF',
    },
    {
      id: 'amethyst',
      crownBright: '#F4C4FF',
      facetLight: '#DA6BFF',
      body: '#B82EFF',
      facetMid: '#8A10D6',
      pavilion: '#570598',
      edgeDeep: '#32025B',
      glow: '#DF92FF',
    },
    {
      id: 'crimson',
      crownBright: '#FFBEB0',
      facetLight: '#FF644E',
      body: '#F2271D',
      facetMid: '#C00E0E',
      pavilion: '#820407',
      edgeDeep: '#4B0203',
      glow: '#FF7666',
    },
  ];

  // Sculpted Silver/Pewter Stone palette for Grey-Out state
  const STONE_GEM = {
    crownBright: '#DCE1E9',
    facetLight: '#B8BFC9',
    body: '#9097A4',
    facetMid: '#6E7582',
    pavilion: '#4C525D',
    edgeDeep: '#2D3139',
    glow: '#B5BBC7',
  };

  // Polyomino catalog with spawn weights
  const SHAPE_DEFS = [
    { weight: 5, matrix: [[1]] }, // 1x1
    { weight: 6, matrix: [[1, 1]] }, // 1x2
    { weight: 6, matrix: [[1], [1]] }, // 2x1
    { weight: 7, matrix: [[1, 1, 1]] }, // 1x3
    { weight: 7, matrix: [[1], [1], [1]] }, // 3x1
    { weight: 5, matrix: [[1, 1, 1, 1]] }, // 1x4
    { weight: 5, matrix: [[1], [1], [1], [1]] }, // 4x1
    { weight: 3, matrix: [[1, 1, 1, 1, 1]] }, // 1x5
    { weight: 3, matrix: [[1], [1], [1], [1], [1]] }, // 5x1
    { weight: 8, matrix: [[1, 1], [1, 1]] }, // 2x2
    { weight: 3, matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }, // 3x3
    // 3-cell corner L shapes
    { weight: 5, matrix: [[1, 0], [1, 1]] },
    { weight: 5, matrix: [[0, 1], [1, 1]] },
    { weight: 5, matrix: [[1, 1], [1, 0]] },
    { weight: 5, matrix: [[1, 1], [0, 1]] },
    // 4-cell L/J shapes
    { weight: 4, matrix: [[1, 0], [1, 0], [1, 1]] },
    { weight: 4, matrix: [[0, 1], [0, 1], [1, 1]] },
    { weight: 4, matrix: [[1, 1, 1], [1, 0, 0]] },
    { weight: 4, matrix: [[1, 1, 1], [0, 0, 1]] },
    // 5-cell big 3x3 L corners
    { weight: 2, matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
    { weight: 2, matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },
    { weight: 2, matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]] },
    { weight: 2, matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] },
    // T shapes
    { weight: 4, matrix: [[1, 1, 1], [0, 1, 0]] },
    { weight: 4, matrix: [[0, 1, 0], [1, 1, 1]] },
    { weight: 3, matrix: [[1, 0], [1, 1], [1, 0]] },
    { weight: 3, matrix: [[0, 1], [1, 1], [0, 1]] },
    // Z / S shapes
    { weight: 3, matrix: [[1, 1, 0], [0, 1, 1]] },
    { weight: 3, matrix: [[0, 1, 1], [1, 1, 0]] },
    { weight: 3, matrix: [[0, 1], [1, 1], [1, 0]] },
    { weight: 3, matrix: [[1, 0], [1, 1], [0, 1]] },
    // Cross / Plus shape
    { weight: 2, matrix: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] },
  ];

  const TOTAL_WEIGHT = SHAPE_DEFS.reduce((acc, s) => acc + s.weight, 0);

  // DOM References
  const stageWrap = document.getElementById('stage-wrap');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const dragCanvas = document.getElementById('drag-canvas');
  const dragCtx = dragCanvas.getContext('2d');

  const scoreEl = document.getElementById('score-val');
  const bestScoreEl = document.getElementById('best-score-val');
  const pauseBtn = document.getElementById('pause-btn');

  const gameShell = document.getElementById('game-shell');
  const startOverlay = document.getElementById('start-overlay');
  const startBestVal = document.getElementById('start-best-val');
  const homeGamesVal = document.getElementById('home-games-val');
  const homeLinesVal = document.getElementById('home-lines-val');
  const savedRunCard = document.getElementById('saved-run-card');
  const homeHighlightsCard = document.getElementById('home-highlights-card');
  const homeMiniBoard = document.getElementById('home-mini-board');
  const miniCtx = homeMiniBoard ? homeMiniBoard.getContext('2d') : null;
  const savedRunScore = document.getElementById('saved-run-score');
  const startPlayBtn = document.getElementById('start-play-btn');
  const startContinueBtn = document.getElementById('start-continue-btn');
  const startNewGameBtn = document.getElementById('start-newgame-btn');
  const homeSoundBtn = document.getElementById('home-sound-btn');
  const homeSoundLabel = document.getElementById('home-sound-label');
  const homeSoundIconOn = document.getElementById('home-sound-icon-on');
  const homeSoundIconOff = document.getElementById('home-sound-icon-off');
  const howToPlayBtn = document.getElementById('how-to-play-btn');
  const howtoOverlay = document.getElementById('howto-overlay');
  const howtoCloseBtn = document.getElementById('howto-close-btn');

  const pauseOverlay = document.getElementById('pause-overlay');
  const resumeBtn = document.getElementById('resume-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundToggleLabel = document.getElementById('sound-toggle-label');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const pauseRestartBtn = document.getElementById('pause-restart-btn');
  const pauseHomeBtn = document.getElementById('pause-home-btn');

  const continueOverlay = document.getElementById('continue-overlay');
  const watchAdBtn = document.getElementById('watch-ad-btn');
  const declineContinueBtn = document.getElementById('decline-continue-btn');

  const rewardedAdOverlay = document.getElementById('rewarded-ad-overlay');
  const adCountdownText = document.getElementById('ad-countdown-text');
  const adRingNum = document.getElementById('ad-ring-num');
  const adRingProgress = document.getElementById('ad-ring-progress');
  const adProgressBar = document.getElementById('ad-progress-bar');

  const gameoverOverlay = document.getElementById('gameover-overlay');
  const finalScoreEl = document.getElementById('final-score-val');
  const finalBestEl = document.getElementById('final-best-val');
  const newBestBadge = document.getElementById('new-best-badge');
  const playAgainBtn = document.getElementById('play-again-btn');
  const gameoverHomeBtn = document.getElementById('gameover-home-btn');

  const adBannerSlot = document.getElementById('ad-banner-slot');

  // Game State
  let board = createEmptyBoard();
  let tray = [null, null, null];
  let score = 0;
  let displayScore = 0;
  let bestScore = loadBestScore();
  let playerStats = loadPlayerStats();
  let runStartBest = bestScore;
  let consecutiveClears = 0;
  let bigClearStreak = 0;
  let hasRevived = false;
  let gameState = 'START'; // START | PLAYING | PAUSED | GREY_OUT | CONTINUE_PROMPT | REWARDED_AD | GAME_OVER
  let greyProgress = 0;
  let greyTarget = 0;
  let greyTimeoutId = null;
  let pendingClear = null;
  let boardDirty = true;

  // Layout Metrics (CSS pixels) & Cached Bounding Rect
  const layout = {
    w: 360,
    h: 560,
    dpr: 1,
    rectLeft: 0,
    rectTop: 0,
    boardOuterX: 0,
    boardOuterY: 0,
    boardOuterSize: 320,
    boardPad: 10,
    gridX: 10,
    gridY: 10,
    gridSize: 300,
    cellSize: 37.5,
    trayX: 0,
    trayY: 360,
    trayW: 320,
    trayH: 108,
    trayCellScale: 0.52,
    slotCenters: [],
  };

  // Pre-rendered Offscreen Sprite Caches
  const sprites = {
    boardBg: null,
    boardGem: [],
    boardStone: null,
    trayGem: [],
    trayStone: null,
  };

  // Active Drag & Animation Lists
  let drag = null;
  const returningPieces = [];
  const particles = [];
  const beams = [];
  const popups = [];
  let traySpawnPop = 1;

  // ---- Utilities ----
  function createEmptyBoard() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  }

  function loadBestScore() {
    try {
      const raw = localStorage.getItem(STORAGE_BEST_KEY);
      const num = parseInt(raw || '0', 10);
      return Number.isFinite(num) && num > 0 ? num : 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBestScore(val) {
    try {
      localStorage.setItem(STORAGE_BEST_KEY, String(val));
    } catch (_) {}
  }

  function loadPlayerStats() {
    try {
      const raw = localStorage.getItem(STORAGE_STATS_KEY);
      if (!raw) return { gamesPlayed: 0, totalLinesCleared: 0 };
      const parsed = JSON.parse(raw);
      return {
        gamesPlayed:
          typeof parsed.gamesPlayed === 'number' && parsed.gamesPlayed > 0
            ? Math.floor(parsed.gamesPlayed)
            : 0,
        totalLinesCleared:
          typeof parsed.totalLinesCleared === 'number' && parsed.totalLinesCleared > 0
            ? Math.floor(parsed.totalLinesCleared)
            : 0,
      };
    } catch (_) {
      return { gamesPlayed: 0, totalLinesCleared: 0 };
    }
  }

  function savePlayerStats() {
    try {
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(playerStats));
    } catch (_) {}
  }

  function renderMiniBoardPreview() {
    if (!miniCtx || !homeMiniBoard) return;
    const size = homeMiniBoard.width;
    const pad = 2;
    const cell = (size - pad * 2) / GRID_SIZE;

    miniCtx.clearRect(0, 0, size, size);
    miniCtx.fillStyle = '#1B1022';
    miniCtx.fillRect(0, 0, size, size);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = pad + c * cell + 0.6;
        const y = pad + r * cell + 0.6;
        const s = cell - 1.2;
        const tile = board[r][c];
        if (!tile) {
          miniCtx.fillStyle = '#382742';
          roundRectPath(miniCtx, x, y, s, s, 1.5);
          miniCtx.fill();
        } else {
          const pal = GEM_COLORS[tile.color] || GEM_COLORS[0];
          const g = miniCtx.createLinearGradient(x, y, x + s, y + s);
          g.addColorStop(0, pal.facetLight);
          g.addColorStop(0.55, pal.body);
          g.addColorStop(1, pal.pavilion);
          miniCtx.fillStyle = g;
          roundRectPath(miniCtx, x, y, s, s, 1.6);
          miniCtx.fill();
        }
      }
    }
  }

  function hasLiveProgress() {
    if (score > 0 || hasRevived || gameState === 'GREY_OUT' || gameState === 'CONTINUE_PROMPT') {
      return true;
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (board[r][c] !== null) return true;
      }
    }
    return false;
  }

  function clearSavedGameState() {
    try {
      localStorage.removeItem(STORAGE_STATE_KEY);
    } catch (_) {}
  }

  function saveGameState() {
    if (gameState === 'GAME_OVER') {
      clearSavedGameState();
      return;
    }
    if (!hasLiveProgress()) {
      clearSavedGameState();
      return;
    }
    try {
      const boardSnapshot = Array.from({ length: GRID_SIZE }, (_, r) =>
        Array.from({ length: GRID_SIZE }, (__, c) => {
          const cell = board[r][c];
          if (!cell) return null;
          if (pendingClear && pendingClear.cellKeys.has(r * GRID_SIZE + c)) return null;
          return cell.color;
        })
      );
      const traySnapshot = tray.map((piece) =>
        piece
          ? {
              color: piece.color,
              matrix: piece.matrix.map((row) => row.slice()),
            }
          : null
      );
      const payload = {
        version: 1,
        board: boardSnapshot,
        tray: traySnapshot,
        score,
        runStartBest,
        consecutiveClears,
        bigClearStreak,
        hasRevived,
        pendingContinue: gameState === 'GREY_OUT' || gameState === 'CONTINUE_PROMPT',
      };
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function buildPieceFromMatrix(rawMatrix, rawColor) {
    if (!Array.isArray(rawMatrix) || rawMatrix.length < 1 || rawMatrix.length > 5) return null;
    const cols = Array.isArray(rawMatrix[0]) ? rawMatrix[0].length : 0;
    if (cols < 1 || cols > 5) return null;
    const matrix = [];
    const cells = [];
    for (let r = 0; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row) || row.length !== cols) return null;
      const cleanRow = [];
      for (let c = 0; c < cols; c++) {
        const val = row[c] ? 1 : 0;
        cleanRow.push(val);
        if (val) cells.push({ r, c });
      }
      matrix.push(cleanRow);
    }
    if (cells.length === 0) return null;
    const color =
      Number.isInteger(rawColor) && rawColor >= 0 && rawColor < GEM_COLORS.length
        ? rawColor
        : 0;
    return {
      matrix,
      rows: matrix.length,
      cols,
      cells,
      color,
    };
  }

  function loadSavedGameState() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return null;
      if (!Array.isArray(parsed.board) || parsed.board.length !== GRID_SIZE) return null;
      if (!Array.isArray(parsed.tray) || parsed.tray.length !== 3) return null;

      let hasTile = false;
      const restoredBoard = createEmptyBoard();
      for (let r = 0; r < GRID_SIZE; r++) {
        const row = parsed.board[r];
        if (!Array.isArray(row) || row.length !== GRID_SIZE) return null;
        for (let c = 0; c < GRID_SIZE; c++) {
          const colorIdx = row[c];
          if (colorIdx === null || colorIdx === undefined) {
            restoredBoard[r][c] = null;
          } else if (Number.isInteger(colorIdx) && colorIdx >= 0 && colorIdx < GEM_COLORS.length) {
            restoredBoard[r][c] = { color: colorIdx, scale: 1, shimmer: 0 };
            hasTile = true;
          } else {
            return null;
          }
        }
      }

      const restoredTray = [null, null, null];
      for (let i = 0; i < 3; i++) {
        if (parsed.tray[i] !== null) {
          const piece = buildPieceFromMatrix(parsed.tray[i].matrix, parsed.tray[i].color);
          if (!piece) return null;
          restoredTray[i] = piece;
        }
      }

      const restoredScore =
        typeof parsed.score === 'number' && Number.isFinite(parsed.score) && parsed.score >= 0
          ? Math.floor(parsed.score)
          : 0;
      const pendingContinue = Boolean(parsed.pendingContinue);
      const restoredRevived = Boolean(parsed.hasRevived);

      if (!hasTile && restoredScore === 0 && !pendingContinue && !restoredRevived) {
        return null;
      }

      return {
        board: restoredBoard,
        tray: restoredTray,
        score: restoredScore,
        runStartBest:
          typeof parsed.runStartBest === 'number' && Number.isFinite(parsed.runStartBest)
            ? Math.max(0, Math.floor(parsed.runStartBest))
            : bestScore,
        consecutiveClears:
          typeof parsed.consecutiveClears === 'number' && parsed.consecutiveClears > 0
            ? Math.floor(parsed.consecutiveClears)
            : 0,
        bigClearStreak:
          typeof parsed.bigClearStreak === 'number' && parsed.bigClearStreak > 0
            ? Math.floor(parsed.bigClearStreak)
            : 0,
        hasRevived: restoredRevived,
        pendingContinue,
      };
    } catch (_) {
      return null;
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pickRandomShapeDef() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (let i = 0; i < SHAPE_DEFS.length; i++) {
      r -= SHAPE_DEFS[i].weight;
      if (r <= 0) return SHAPE_DEFS[i];
    }
    return SHAPE_DEFS[0];
  }

  function createShapeInstance() {
    const def = pickRandomShapeDef();
    const matrix = def.matrix;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c]) cells.push({ r, c });
      }
    }
    const color = Math.floor(Math.random() * GEM_COLORS.length);
    return { matrix, rows, cols, cells, color };
  }

  function refillTray() {
    for (let i = 0; i < 3; i++) {
      tray[i] = createShapeInstance();
    }
    traySpawnPop = 0.01;
    boardDirty = true;
  }

  // ---- Offscreen Canvas Path & High-Craft Gem Sprite Builders ----
  function roundRectPath(targetCtx, x, y, w, h, r) {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    targetCtx.beginPath();
    targetCtx.moveTo(x + rad, y);
    targetCtx.lineTo(x + w - rad, y);
    targetCtx.quadraticCurveTo(x + w, y, x + w, y + rad);
    targetCtx.lineTo(x + w, y + h - rad);
    targetCtx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    targetCtx.lineTo(x + rad, y + h);
    targetCtx.quadraticCurveTo(x, y + h, x, y + h - rad);
    targetCtx.lineTo(x, y + rad);
    targetCtx.quadraticCurveTo(x, y, x + rad, y);
    targetCtx.closePath();
  }

  function drawStarburstGlint(targetCtx, cx, cy, radius) {
    targetCtx.save();
    // Soft radial halo
    const halo = targetCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    halo.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    targetCtx.fillStyle = halo;
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    targetCtx.fill();

    // Crisp 4-point diamond starburst
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ox = cx + Math.cos(a) * radius * 0.98;
      const oy = cy + Math.sin(a) * radius * 0.98;
      const ix = cx + Math.cos(a + Math.PI / 4) * (radius * 0.16);
      const iy = cy + Math.sin(a + Math.PI / 4) * (radius * 0.16);
      if (i === 0) targetCtx.moveTo(ox, oy);
      else targetCtx.lineTo(ox, oy);
      targetCtx.lineTo(ix, iy);
    }
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.restore();
  }

  function buildGemSprite(cssSize, dpr, palette, isStone) {
    const px = Math.max(8, Math.round(cssSize * dpr));
    const off = document.createElement('canvas');
    off.width = px;
    off.height = px;
    const sCtx = off.getContext('2d');
    sCtx.scale(dpr, dpr);

    const pad = Math.max(0.8, cssSize * CELL_PAD_RATIO);
    const tileS = cssSize - pad * 2;
    const gx = pad;
    const gy = pad;
    const gs = tileS;
    const gemR = Math.max(3, gs * 0.14);

    // Multi-Faceted Crystal Gem filling the tile cleanly (no brown/tan outer frame)
    sCtx.save();
    roundRectPath(sCtx, gx, gy, gs, gs, gemR);
    sCtx.clip();

    // Base rich jewel gradient
    const baseGrad = sCtx.createLinearGradient(gx, gy, gx + gs, gy + gs);
    baseGrad.addColorStop(0, palette.facetLight);
    baseGrad.addColorStop(0.45, palette.body);
    baseGrad.addColorStop(1, palette.pavilion);
    sCtx.fillStyle = baseGrad;
    sCtx.fillRect(gx, gy, gs, gs);

    // Outer cushion bevel facets inside gem
    const cush = gs * 0.135;
    // Top-left bright crown bevel
    sCtx.fillStyle = palette.crownBright;
    sCtx.globalAlpha = isStone ? 0.3 : 0.44;
    sCtx.beginPath();
    sCtx.moveTo(gx, gy);
    sCtx.lineTo(gx + gs, gy);
    sCtx.lineTo(gx + gs - cush, gy + cush);
    sCtx.lineTo(gx + cush, gy + cush);
    sCtx.lineTo(gx + cush, gy + gs - cush);
    sCtx.lineTo(gx, gy + gs);
    sCtx.closePath();
    sCtx.fill();

    // Bottom-right deep pavilion bevel
    sCtx.fillStyle = palette.edgeDeep;
    sCtx.globalAlpha = 0.58;
    sCtx.beginPath();
    sCtx.moveTo(gx + gs, gy);
    sCtx.lineTo(gx + gs, gy + gs);
    sCtx.lineTo(gx, gy + gs);
    sCtx.lineTo(gx + cush, gy + gs - cush);
    sCtx.lineTo(gx + gs - cush, gy + gs - cush);
    sCtx.lineTo(gx + gs - cush, gy + cush);
    sCtx.closePath();
    sCtx.fill();

    // Layered diagonal crystal facet ribbons
    sCtx.globalAlpha = isStone ? 0.25 : 0.38;
    sCtx.fillStyle = palette.crownBright;
    sCtx.beginPath();
    sCtx.moveTo(gx, gy + gs * 0.24);
    sCtx.lineTo(gx + gs * 0.56, gy);
    sCtx.lineTo(gx + gs * 0.88, gy);
    sCtx.lineTo(gx, gy + gs * 0.68);
    sCtx.closePath();
    sCtx.fill();

    sCtx.globalAlpha = isStone ? 0.18 : 0.28;
    sCtx.fillStyle = '#FFFFFF';
    sCtx.beginPath();
    sCtx.moveTo(gx + cush, gy + gs * 0.42);
    sCtx.lineTo(gx + gs * 0.64, gy + cush);
    sCtx.lineTo(gx + gs * 0.84, gy + gs * 0.28);
    sCtx.lineTo(gx + gs * 0.34, gy + gs * 0.78);
    sCtx.closePath();
    sCtx.fill();

    // Cross-diagonal mid-table facet plane
    sCtx.globalAlpha = isStone ? 0.22 : 0.32;
    sCtx.fillStyle = palette.facetMid;
    sCtx.beginPath();
    sCtx.moveTo(gx + gs * 0.2, gy + cush);
    sCtx.lineTo(gx + gs - cush, gy + gs * 0.72);
    sCtx.lineTo(gx + gs - cush, gy + gs - cush);
    sCtx.lineTo(gx + gs * 0.66, gy + gs - cush);
    sCtx.lineTo(gx + cush, gy + gs * 0.38);
    sCtx.closePath();
    sCtx.fill();

    // Center luminous table diamond facet
    sCtx.globalAlpha = isStone ? 0.2 : 0.34;
    const diamondGrad = sCtx.createLinearGradient(
      gx + gs * 0.24,
      gy + gs * 0.24,
      gx + gs * 0.76,
      gy + gs * 0.76
    );
    diamondGrad.addColorStop(0, '#FFFFFF');
    diamondGrad.addColorStop(0.55, palette.facetLight);
    diamondGrad.addColorStop(1, palette.pavilion);
    sCtx.fillStyle = diamondGrad;
    sCtx.beginPath();
    sCtx.moveTo(gx + gs * 0.5, gy + gs * 0.15);
    sCtx.lineTo(gx + gs * 0.85, gy + gs * 0.5);
    sCtx.lineTo(gx + gs * 0.5, gy + gs * 0.85);
    sCtx.lineTo(gx + gs * 0.15, gy + gs * 0.5);
    sCtx.closePath();
    sCtx.fill();

    // Corner facet triangles for crystal refraction depth
    sCtx.globalAlpha = 0.42;
    sCtx.fillStyle = palette.edgeDeep;
    sCtx.beginPath();
    sCtx.moveTo(gx, gy + gs);
    sCtx.lineTo(gx + gs * 0.28, gy + gs);
    sCtx.lineTo(gx, gy + gs * 0.72);
    sCtx.closePath();
    sCtx.fill();

    sCtx.beginPath();
    sCtx.moveTo(gx + gs, gy);
    sCtx.lineTo(gx + gs, gy + gs * 0.28);
    sCtx.lineTo(gx + gs * 0.72, gy);
    sCtx.closePath();
    sCtx.fill();

    // Crisp minimal self-colored edge & top-left specular rim
    sCtx.globalAlpha = isStone ? 0.32 : 0.62;
    sCtx.strokeStyle = palette.crownBright;
    sCtx.lineWidth = Math.max(0.9, gs * 0.032);
    roundRectPath(sCtx, gx + 0.5, gy + 0.5, gs - 1, gs - 1, gemR);
    sCtx.stroke();

    sCtx.globalAlpha = 0.5;
    sCtx.strokeStyle = palette.edgeDeep;
    sCtx.lineWidth = Math.max(0.8, gs * 0.024);
    roundRectPath(sCtx, gx + 0.4, gy + 0.4, gs - 0.8, gs - 0.8, gemR);
    sCtx.stroke();

    sCtx.restore();

    // Crisp Starburst Specular Glint (upper-right facet edge)
    if (!isStone) {
      const glintR = Math.max(2.6, gs * 0.185);
      drawStarburstGlint(sCtx, gx + gs * 0.81, gy + gs * 0.17, glintR);
    } else {
      const glintR = Math.max(2, gs * 0.13);
      sCtx.save();
      sCtx.globalAlpha = 0.45;
      drawStarburstGlint(sCtx, gx + gs * 0.81, gy + gs * 0.17, glintR);
      sCtx.restore();
    }

    return off;
  }

  function drawStonePlaqueTo(targetCtx, x, y, w, h, radius) {
    const bgGrad = targetCtx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#3D2B48');
    bgGrad.addColorStop(0.5, '#2E1F38');
    bgGrad.addColorStop(1, '#23162C');

    targetCtx.save();
    targetCtx.shadowColor = 'rgba(0,0,0,0.58)';
    targetCtx.shadowBlur = 16;
    targetCtx.shadowOffsetY = 6;
    roundRectPath(targetCtx, x, y, w, h, radius);
    targetCtx.fillStyle = bgGrad;
    targetCtx.fill();
    targetCtx.restore();

    roundRectPath(targetCtx, x + 1, y + 1, w - 2, h - 2, radius - 1);
    targetCtx.strokeStyle = '#5B426B';
    targetCtx.lineWidth = 2;
    targetCtx.stroke();

    targetCtx.save();
    targetCtx.strokeStyle = 'rgba(18, 9, 25, 0.55)';
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.moveTo(x + w * 0.72, y + 1);
    targetCtx.lineTo(x + w * 0.74, y + 7);
    targetCtx.lineTo(x + w * 0.77, y + 10);
    targetCtx.moveTo(x + w * 0.22, y + h - 1);
    targetCtx.lineTo(x + w * 0.24, y + h - 7);
    targetCtx.stroke();
    targetCtx.restore();
  }

  function rebuildOffscreenCaches() {
    const { w, h, dpr, cellSize, trayCellScale } = layout;

    // 1. Pre-render Static Board + 64 Recessed Cells + Tray Plaque onto single offscreen canvas
    const bg = document.createElement('canvas');
    bg.width = Math.round(w * dpr);
    bg.height = Math.round(h * dpr);
    const bCtx = bg.getContext('2d');
    bCtx.scale(dpr, dpr);

    drawStonePlaqueTo(
      bCtx,
      layout.boardOuterX,
      layout.boardOuterY,
      layout.boardOuterSize,
      layout.boardOuterSize,
      16
    );

    roundRectPath(
      bCtx,
      layout.gridX - 3,
      layout.gridY - 3,
      layout.gridSize + 6,
      layout.gridSize + 6,
      10
    );
    bCtx.fillStyle = '#1B1022';
    bCtx.fill();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cx = layout.gridX + c * cellSize;
        const cy = layout.gridY + r * cellSize;
        const pad = Math.max(1.2, cellSize * 0.036);
        const s = cellSize - pad * 2;
        roundRectPath(bCtx, cx + pad, cy + pad, s, s, Math.max(3, s * 0.11));
        bCtx.fillStyle = '#382742';
        bCtx.fill();

        bCtx.strokeStyle = 'rgba(255, 225, 255, 0.06)';
        bCtx.lineWidth = 1;
        bCtx.stroke();
      }
    }

    drawStonePlaqueTo(bCtx, layout.trayX, layout.trayY, layout.trayW, layout.trayH, 16);
    roundRectPath(
      bCtx,
      layout.trayX + 8,
      layout.trayY + 8,
      layout.trayW - 16,
      layout.trayH - 16,
      11
    );
    bCtx.strokeStyle = 'rgba(20, 10, 26, 0.45)';
    bCtx.lineWidth = 1.5;
    bCtx.stroke();

    sprites.boardBg = bg;

    // 2. Pre-render Full-Size & Tray-Size Sculpted Gem Sprites
    const traySize = cellSize * trayCellScale;
    sprites.boardGem = GEM_COLORS.map((pal) => buildGemSprite(cellSize, dpr, pal, false));
    sprites.boardStone = buildGemSprite(cellSize, dpr, STONE_GEM, true);
    sprites.trayGem = GEM_COLORS.map((pal) => buildGemSprite(traySize, dpr, pal, false));
    sprites.trayStone = buildGemSprite(traySize, dpr, STONE_GEM, true);
  }

  // ---- Placement & Fit Checks ----
  function isCellEmptyForPlacement(r, c) {
    if (board[r][c] === null) return true;
    return Boolean(pendingClear && pendingClear.cellKeys.has(r * GRID_SIZE + c));
  }

  function canPlace(shape, startRow, startCol) {
    if (!shape) return false;
    for (let i = 0; i < shape.cells.length; i++) {
      const r = startRow + shape.cells[i].r;
      const c = startCol + shape.cells[i].c;
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
      if (!isCellEmptyForPlacement(r, c)) return false;
    }
    return true;
  }

  function canShapeFitAnywhere(shape) {
    if (!shape) return false;
    const maxR = GRID_SIZE - shape.rows;
    const maxC = GRID_SIZE - shape.cols;
    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c <= maxC; c++) {
        if (canPlace(shape, r, c)) return true;
      }
    }
    return false;
  }

  function hasAnyValidMove() {
    for (let i = 0; i < 3; i++) {
      if (tray[i] && canShapeFitAnywhere(tray[i])) return true;
    }
    return false;
  }

  function getSimulatedClears(shape, startRow, startCol) {
    const placedSet = new Set();
    for (let i = 0; i < shape.cells.length; i++) {
      placedSet.add((startRow + shape.cells[i].r) * GRID_SIZE + (startCol + shape.cells[i].c));
    }
    const fullRows = [];
    const fullCols = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      let full = true;
      for (let c = 0; c < GRID_SIZE; c++) {
        const key = r * GRID_SIZE + c;
        if (isCellEmptyForPlacement(r, c) && !placedSet.has(key)) {
          full = false;
          break;
        }
      }
      if (full) fullRows.push(r);
    }

    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        const key = r * GRID_SIZE + c;
        if (isCellEmptyForPlacement(r, c) && !placedSet.has(key)) {
          full = false;
          break;
        }
      }
      if (full) fullCols.push(c);
    }

    return {
      fullRows,
      fullCols,
      rowSet: new Set(fullRows),
      colSet: new Set(fullCols),
    };
  }

  // ---- Layout Calculation ----
  function refreshCachedCanvasRect() {
    const rect = canvas.getBoundingClientRect();
    layout.rectLeft = rect.left;
    layout.rectTop = rect.top;
  }

  function resizeCanvas() {
    const rect = stageWrap.getBoundingClientRect();
    const w = Math.max(240, rect.width);
    const h = Math.max(320, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    layout.w = w;
    layout.h = h;
    layout.dpr = dpr;

    const maxBoardW = w - 6;
    const maxBoardH = h * 0.68;
    const rawBoard = Math.floor(Math.min(maxBoardW, maxBoardH));
    const boardPad = Math.max(8, Math.round(rawBoard * 0.032));
    const cellSize = Math.floor((rawBoard - boardPad * 2) / GRID_SIZE);
    const gridSize = cellSize * GRID_SIZE;
    const boardOuterSize = gridSize + boardPad * 2;

    const trayW = boardOuterSize;
    const trayH = Math.max(88, Math.min(128, Math.round((h - boardOuterSize) * 0.62)));
    const gapBetween = Math.max(12, Math.min(34, Math.round((h - boardOuterSize - trayH) * 0.42)));
    const totalStackH = boardOuterSize + gapBetween + trayH;
    const startY = Math.max(4, Math.round((h - totalStackH) * 0.46));

    layout.boardOuterSize = boardOuterSize;
    layout.boardOuterX = Math.round((w - boardOuterSize) / 2);
    layout.boardOuterY = startY;
    layout.boardPad = boardPad;
    layout.gridX = layout.boardOuterX + boardPad;
    layout.gridY = layout.boardOuterY + boardPad;
    layout.gridSize = gridSize;
    layout.cellSize = cellSize;

    layout.trayX = layout.boardOuterX;
    layout.trayY = layout.boardOuterY + boardOuterSize + gapBetween;
    layout.trayW = trayW;
    layout.trayH = trayH;
    const maxTrayCell = (trayH - 22) / 5;
    const prefTrayCell = cellSize * 0.52;
    layout.trayCellScale = Math.min(0.56, Math.max(0.36, Math.min(prefTrayCell, maxTrayCell * 1.15) / cellSize));

    const slotW = trayW / 3;
    layout.slotCenters = [
      { x: layout.trayX + slotW * 0.5, y: layout.trayY + trayH * 0.5 },
      { x: layout.trayX + slotW * 1.5, y: layout.trayY + trayH * 0.5 },
      { x: layout.trayX + slotW * 2.5, y: layout.trayY + trayH * 0.5 },
    ];

    refreshCachedCanvasRect();
    rebuildOffscreenCaches();
    boardDirty = true;
  }

  // ---- HUD & Game Flow ----
  function syncHudImmediate() {
    scoreEl.textContent = String(score);
    bestScoreEl.textContent = String(bestScore);
  }

  function addScore(delta) {
    if (delta <= 0) return;
    score += delta;
    if (score > bestScore) {
      bestScore = score;
      saveBestScore(bestScore);
      bestScoreEl.textContent = String(bestScore);
    }
  }

  function syncSoundUi() {
    const muted = global.GemAudio.isMuted();
    const labelText = muted ? 'Sound: Off' : 'Sound: On';
    soundToggleLabel.textContent = labelText;
    soundIconOn.classList.toggle('hidden', muted);
    soundIconOff.classList.toggle('hidden', !muted);

    homeSoundLabel.textContent = labelText;
    homeSoundIconOn.classList.toggle('hidden', muted);
    homeSoundIconOff.classList.toggle('hidden', !muted);
  }

  function unmountAllNativeInlineAds() {
    if (!global.AdManager) return;
    global.AdManager.unmountNativeInline('home-native-ad');
    global.AdManager.unmountNativeInline('pause-native-ad');
    global.AdManager.unmountNativeInline('gameover-native-ad');
  }

  function hideAllModals() {
    unmountAllNativeInlineAds();
    startOverlay.classList.add('hidden');
    howtoOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    continueOverlay.classList.add('hidden');
    rewardedAdOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
  }

  function hideDragLayer() {
    dragCanvas.style.transform = 'translate3d(-9999px, -9999px, 0)';
  }

  function resetFreshRunData() {
    if (greyTimeoutId) {
      clearTimeout(greyTimeoutId);
      greyTimeoutId = null;
    }
    board = createEmptyBoard();
    tray = [null, null, null];
    score = 0;
    displayScore = 0;
    runStartBest = bestScore;
    consecutiveClears = 0;
    bigClearStreak = 0;
    hasRevived = false;
    greyProgress = 0;
    greyTarget = 0;
    pendingClear = null;
    drag = null;
    hideDragLayer();
    returningPieces.length = 0;
    particles.length = 0;
    beams.length = 0;
    popups.length = 0;
    refillTray();
  }

  function showHomeScreen() {
    drag = null;
    hideDragLayer();
    gameState = 'START';
    hideAllModals();
    syncHudImmediate();
    syncSoundUi();
    startBestVal.textContent = String(bestScore);
    homeGamesVal.textContent = String(playerStats.gamesPlayed);
    homeLinesVal.textContent = String(playerStats.totalLinesCleared);

    const canResume = hasLiveProgress();
    startPlayBtn.classList.toggle('hidden', canResume);
    startContinueBtn.classList.toggle('hidden', !canResume);
    startNewGameBtn.classList.toggle('hidden', !canResume);
    savedRunCard.classList.toggle('hidden', !canResume);
    homeHighlightsCard.classList.toggle('hidden', canResume);
    if (canResume) {
      savedRunScore.textContent = String(score);
      renderMiniBoardPreview();
    }

    startOverlay.classList.remove('hidden');
    if (global.AdManager) {
      global.AdManager.mountNativeInline('home-native-ad');
    }
    boardDirty = true;
  }

  function resumeCurrentGame() {
    if (tray.every((item) => item === null)) {
      refillTray();
    }
    hideAllModals();
    traySpawnPop = 1;
    greyTarget = 0;
    greyProgress = 0;
    gameState = 'PLAYING';
    syncHudImmediate();
    boardDirty = true;
    if (!hasAnyValidMove()) {
      beginGreyOutSequence();
    }
  }

  function startNewGame() {
    clearSavedGameState();
    resetFreshRunData();
    playerStats.gamesPlayed += 1;
    savePlayerStats();
    gameState = 'PLAYING';
    hideAllModals();
    syncHudImmediate();
    boardDirty = true;
  }

  function openPauseMenu() {
    if (gameState !== 'PLAYING') return;
    if (pendingClear) {
      finalizePendingClear();
    }
    global.GemAudio.playUiClick();
    drag = null;
    hideDragLayer();
    gameState = 'PAUSED';
    saveGameState();
    syncSoundUi();
    pauseOverlay.classList.remove('hidden');
    if (global.AdManager) {
      global.AdManager.mountNativeInline('pause-native-ad');
    }
    boardDirty = true;
  }

  function closePauseMenu() {
    if (gameState !== 'PAUSED') return;
    global.GemAudio.playUiClick();
    unmountAllNativeInlineAds();
    pauseOverlay.classList.add('hidden');
    gameState = 'PLAYING';
    boardDirty = true;
  }

  function showGameOverScreen() {
    gameState = 'GAME_OVER';
    clearSavedGameState();
    hideAllModals();
    finalScoreEl.textContent = String(score);
    finalBestEl.textContent = String(bestScore);
    const beatRecord = score > 0 && score > runStartBest;
    newBestBadge.classList.toggle('hidden', !beatRecord);
    gameoverOverlay.classList.remove('hidden');
    if (global.AdManager) {
      global.AdManager.mountNativeInline('gameover-native-ad');
    }
  }

  function beginGreyOutSequence() {
    gameState = 'GREY_OUT';
    drag = null;
    hideDragLayer();
    greyTarget = 1;
    boardDirty = true;
    saveGameState();
    global.GemAudio.playGameOver();

    if (greyTimeoutId) clearTimeout(greyTimeoutId);
    greyTimeoutId = setTimeout(() => {
      greyTimeoutId = null;
      if (!hasRevived) {
        gameState = 'CONTINUE_PROMPT';
        saveGameState();
        continueOverlay.classList.remove('hidden');
      } else {
        showGameOverScreen();
      }
    }, 800);
  }

  function spawnCellShatter(r, c, colorIdx) {
    const cs = layout.cellSize;
    const cx = layout.gridX + c * cs + cs * 0.5;
    const cy = layout.gridY + r * cs + cs * 0.5;
    const gem = GEM_COLORS[colorIdx] || GEM_COLORS[0];

    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 210;
      particles.push({
        type: 'shard',
        x: cx + (Math.random() - 0.5) * cs * 0.5,
        y: cy + (Math.random() - 0.5) * cs * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        gravity: 540,
        size: cs * (0.12 + Math.random() * 0.14),
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 12,
        color: i % 2 === 0 ? gem.facetLight : gem.crownBright,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
      });
    }

    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 110;
      particles.push({
        type: 'star',
        x: cx + (Math.random() - 0.5) * cs * 0.65,
        y: cy + (Math.random() - 0.5) * cs * 0.65,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        gravity: 90,
        size: cs * (0.22 + Math.random() * 0.18),
        rot: 0,
        rotV: (Math.random() - 0.5) * 4,
        color: gem.glow,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3,
      });
    }
  }

  function handleReviveReward() {
    hasRevived = true;
    greyTarget = 0;
    greyProgress = 0;
    gameState = 'PLAYING';
    hideAllModals();

    for (let r = 2; r <= 5; r++) {
      for (let c = 2; c <= 5; c++) {
        if (board[r][c] !== null) {
          spawnCellShatter(r, c, board[r][c].color);
          board[r][c] = null;
        }
      }
    }

    if (!hasAnyValidMove()) {
      for (let i = 0; i < GRID_SIZE; i++) {
        if (board[3][i] !== null) {
          spawnCellShatter(3, i, board[3][i].color);
          board[3][i] = null;
        }
        if (board[i][3] !== null) {
          spawnCellShatter(i, 3, board[i][3].color);
          board[i][3] = null;
        }
      }
    }

    beams.push({
      kind: 'area',
      x: layout.gridX + 2 * layout.cellSize,
      y: layout.gridY + 2 * layout.cellSize,
      w: 4 * layout.cellSize,
      h: 4 * layout.cellSize,
      color: '#54F2FF',
      life: 0,
      maxLife: 0.55,
    });

    boardDirty = true;
    global.GemAudio.playRevive();
    saveGameState();
  }

  // ---- Place Piece & Evaluate Clears / Color Shift ----
  function finalizePendingClear() {
    if (!pendingClear) return;
    const clearJob = pendingClear;
    pendingClear = null;

    clearJob.fullRows.forEach((r) => {
      beams.push({
        kind: 'row',
        row: r,
        color: '#54F2FF',
        life: 0,
        maxLife: 0.42,
      });
    });

    clearJob.fullCols.forEach((c) => {
      beams.push({
        kind: 'col',
        col: c,
        color: '#54F2FF',
        life: 0,
        maxLife: 0.42,
      });
    });

    clearJob.cellKeys.forEach((key) => {
      const r = Math.floor(key / GRID_SIZE);
      const c = key % GRID_SIZE;
      const cell = board[r][c];
      if (cell) {
        spawnCellShatter(r, c, cell.color);
        board[r][c] = null;
      }
    });

    if (tray.every((item) => item === null)) {
      refillTray();
    }

    boardDirty = true;
    saveGameState();
    if (gameState === 'PLAYING' && !hasAnyValidMove()) {
      beginGreyOutSequence();
    }
  }

  function commitPlacement(slotIndex, piece, startRow, startCol) {
    if (pendingClear) {
      finalizePendingClear();
    }

    const placedColor = piece.color;
    let sumR = 0;
    let sumC = 0;

    for (let i = 0; i < piece.cells.length; i++) {
      const r = startRow + piece.cells[i].r;
      const c = startCol + piece.cells[i].c;
      sumR += r;
      sumC += c;
      board[r][c] = {
        color: placedColor,
        scale: 1.18,
        shimmer: 0,
      };
    }

    tray[slotIndex] = null;
    addScore(piece.cells.length);
    boardDirty = true;
    global.GemAudio.playPlace();

    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      if (board[r].every((cell) => cell !== null)) fullRows.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (board[r][c] === null) {
          full = false;
          break;
        }
      }
      if (full) fullCols.push(c);
    }

    const linesCleared = fullRows.length + fullCols.length;
    if (linesCleared > 0) {
      playerStats.totalLinesCleared += linesCleared;
      savePlayerStats();
      consecutiveClears += 1;
      const lineBonus = linesCleared * 20;
      addScore(lineBonus);

      const cs = layout.cellSize;
      const clearedCells = new Set();
      fullRows.forEach((r) => {
        for (let c = 0; c < GRID_SIZE; c++) clearedCells.add(r * GRID_SIZE + c);
      });
      fullCols.forEach((c) => {
        for (let r = 0; r < GRID_SIZE; r++) clearedCells.add(r * GRID_SIZE + c);
      });

      const altColors = GEM_COLORS.map((_, idx) => idx).filter((idx) => idx !== placedColor);
      const nextColor = altColors[Math.floor(Math.random() * altColors.length)];
      const clusterTransformColor = placedColor === 0 ? nextColor : 0;

      // Update colors cleanly inside board data model before shattering
      let transformedRemaining = false;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = board[r][c];
          if (!cell) continue;
          const key = r * GRID_SIZE + c;
          if (clearedCells.has(key)) {
            cell.color = clusterTransformColor;
            cell.shimmer = 0.9;
            cell.scale = 1.1;
          } else if (cell.color === placedColor) {
            cell.color = nextColor;
            cell.shimmer = 1.0;
            cell.scale = 1.15;
            transformedRemaining = true;
          }
        }
      }

      pendingClear = {
        fullRows,
        fullCols,
        rowSet: new Set(fullRows),
        colSet: new Set(fullCols),
        cellKeys: clearedCells,
        life: 0,
        duration: 0.28,
      };

      let callout = null;
      let tier = 0;
      let calloutPalette = ['#8CF7FF', '#00B0FF'];

      if (linesCleared >= 3) {
        bigClearStreak += 1;
        tier = Math.min(4, (linesCleared - 2) + (bigClearStreak - 1));
        if (tier === 1) {
          callout = 'Good!';
          calloutPalette = ['#B7FF6A', '#29D424'];
        } else if (tier === 2) {
          callout = 'Wow!';
          calloutPalette = ['#FFF176', '#FF9800'];
        } else if (tier === 3) {
          callout = 'Amazing!';
          calloutPalette = ['#8CF7FF', '#00B0FF'];
        } else {
          callout = 'Excellent!';
          calloutPalette = ['#FF9EE8', '#D500F9'];
        }
      } else {
        bigClearStreak = 0;
      }

      const avgR = sumR / piece.cells.length;
      const avgC = sumC / piece.cells.length;
      const px = Math.max(
        layout.gridX + cs * 1.7,
        Math.min(layout.gridX + layout.gridSize - cs * 1.7, layout.gridX + (avgC + 0.5) * cs)
      );
      const py = Math.max(
        layout.gridY + cs * 1.4,
        Math.min(layout.gridY + layout.gridSize - cs * 1.2, layout.gridY + (avgR + 0.5) * cs)
      );

      popups.push({
        label: callout,
        points: `+${lineBonus}`,
        colors: calloutPalette,
        x: px,
        y: py,
        life: 0,
        maxLife: callout ? 1.15 : 0.85,
      });

      global.GemAudio.playLineClear(linesCleared, consecutiveClears);
      if (transformedRemaining) global.GemAudio.playColorShift();
      if (callout) {
        global.GemAudio.speakCallout(callout, tier);
      }
      saveGameState();
    } else {
      consecutiveClears = 0;
      bigClearStreak = 0;

      if (tray.every((item) => item === null)) {
        refillTray();
      }
      saveGameState();
      if (!hasAnyValidMove()) {
        beginGreyOutSequence();
      }
    }
  }

  // ---- GPU Drag Layer Pre-Rendering & Input Handling ----
  function prepareDragLayerSprite(piece) {
    const cs = layout.cellSize;
    const dpr = layout.dpr;
    const pad = DRAG_SHADOW_PAD;
    const cssW = piece.cols * cs + pad * 2;
    const cssH = piece.rows * cs + pad * 2;

    dragCanvas.width = Math.round(cssW * dpr);
    dragCanvas.height = Math.round(cssH * dpr);
    dragCanvas.style.width = `${cssW}px`;
    dragCanvas.style.height = `${cssH}px`;

    dragCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dragCtx.clearRect(0, 0, cssW, cssH);

    // Pre-bake soft shadow once at pickup so dragging runs at pure 60fps GPU translate3d
    dragCtx.save();
    dragCtx.shadowColor = 'rgba(0, 0, 0, 0.52)';
    dragCtx.shadowBlur = 14;
    dragCtx.shadowOffsetY = 8;
    const sprite = sprites.boardGem[piece.color];
    for (let i = 0; i < piece.cells.length; i++) {
      const c = piece.cells[i];
      dragCtx.drawImage(sprite, pad + c.c * cs, pad + c.r * cs, cs, cs);
    }
    dragCtx.restore();

    return { cssW, cssH };
  }

  function findTraySlotHit(x, y) {
    if (y < layout.trayY - 14 || y > layout.trayY + layout.trayH + 16) return -1;
    if (x < layout.trayX - 8 || x > layout.trayX + layout.trayW + 8) return -1;
    const slotW = layout.trayW / 3;
    const idx = Math.floor((x - layout.trayX) / slotW);
    if (idx < 0 || idx > 2) return -1;
    return tray[idx] ? idx : -1;
  }

  function computeLiftOffset(piece, pointerType) {
    if (pointerType === 'mouse') {
      return Math.max(layout.cellSize * 0.75, piece.rows * layout.cellSize * 0.36);
    }
    return Math.max(layout.cellSize * 1.85, piece.rows * layout.cellSize * 0.45 + layout.cellSize * 1.1);
  }

  function updateDragSnapState() {
    if (!drag) return;
    const cs = layout.cellSize;
    const pieceW = drag.piece.cols * cs;
    const pieceH = drag.piece.rows * cs;
    const visLeft = drag.x - pieceW * 0.5;
    const visTop = drag.y - drag.liftY - pieceH * 0.5;

    const withinBoardX =
      visLeft > layout.gridX - cs * 0.85 && visLeft + pieceW < layout.gridX + layout.gridSize + cs * 0.85;
    const withinBoardY =
      visTop > layout.gridY - cs * 0.85 && visTop + pieceH < layout.gridY + layout.gridSize + cs * 0.85;

    let snapRow = -99;
    let snapCol = -99;
    if (withinBoardX && withinBoardY) {
      snapCol = Math.round((visLeft - layout.gridX) / cs);
      snapRow = Math.round((visTop - layout.gridY) / cs);
    }

    if (snapRow === drag.lastSnapRow && snapCol === drag.lastSnapCol) {
      return;
    }

    drag.lastSnapRow = snapRow;
    drag.lastSnapCol = snapCol;

    if (snapRow >= 0 && snapCol >= 0 && canPlace(drag.piece, snapRow, snapCol)) {
      drag.hover = { row: snapRow, col: snapCol };
      drag.previewClears = getSimulatedClears(drag.piece, snapRow, snapCol);
    } else {
      drag.hover = null;
      drag.previewClears = null;
    }
    boardDirty = true;
  }

  function applyDragTransform() {
    if (!drag) return;
    const tx = drag.x - drag.dragW * 0.5;
    const ty = drag.y - drag.liftY - drag.dragH * 0.5;
    dragCanvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${drag.scale.toFixed(4)})`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    global.GemAudio.unlock();
    if (gameState !== 'PLAYING' || drag) return;

    // Refresh bounding box once on pointerdown (never inside pointermove!)
    refreshCachedCanvasRect();
    const px = e.clientX - layout.rectLeft;
    const py = e.clientY - layout.rectTop;

    const slotIndex = findTraySlotHit(px, py);
    if (slotIndex === -1) return;

    const piece = tray[slotIndex];
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const { cssW, cssH } = prepareDragLayerSprite(piece);

    drag = {
      pointerId: e.pointerId,
      slotIndex,
      piece,
      x: px,
      y: py,
      targetX: px,
      targetY: py,
      liftY: computeLiftOffset(piece, e.pointerType),
      scale: layout.trayCellScale,
      dragW: cssW,
      dragH: cssH,
      lastSnapRow: -99,
      lastSnapCol: -99,
      hover: null,
      previewClears: null,
    };

    applyDragTransform();
    updateDragSnapState();
    boardDirty = true;
    global.GemAudio.playPickup();
  });

  // Pure coordinate storage — zero DOM writes, zero layout queries, zero redraws on pointermove
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.targetX = e.clientX - layout.rectLeft;
    drag.targetY = e.clientY - layout.rectTop;
  });

  function finishDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const active = drag;
    if (!cancelled) {
      active.x = e.clientX - layout.rectLeft;
      active.y = e.clientY - layout.rectTop;
      updateDragSnapState();
    }

    drag = null;
    hideDragLayer();
    boardDirty = true;

    if (!cancelled && active.hover && canPlace(active.piece, active.hover.row, active.hover.col)) {
      commitPlacement(active.slotIndex, active.piece, active.hover.row, active.hover.col);
    } else {
      const target = layout.slotCenters[active.slotIndex];
      returningPieces.push({
        slotIndex: active.slotIndex,
        piece: active.piece,
        fromX: active.x,
        fromY: active.y - active.liftY,
        toX: target.x,
        toY: target.y,
        fromScale: active.scale,
        toScale: layout.trayCellScale,
        t: 0,
      });
      if (!cancelled) {
        global.GemAudio.playInvalid();
      }
    }
  }

  canvas.addEventListener('pointerup', (e) => finishDrag(e, false));
  canvas.addEventListener('pointercancel', (e) => finishDrag(e, true));

  // ---- Fast Sprite Blitting Helpers ----
  function blitTileSprite(sprite, stoneSprite, x, y, size, options) {
    const opts = options || {};
    const alpha = opts.alpha !== undefined ? opts.alpha : 1;
    const scale = opts.scale !== undefined ? opts.scale : 1;
    const grey = opts.grey !== undefined ? opts.grey : 0;
    const shimmer = opts.shimmer !== undefined ? opts.shimmer : 0;

    const needsSave = alpha < 0.999 || scale !== 1 || grey > 0.002 || shimmer > 0.01;
    if (!needsSave) {
      ctx.drawImage(sprite, x, y, size, size);
      return;
    }

    ctx.save();
    if (alpha < 0.999) ctx.globalAlpha = alpha;
    if (scale !== 1) {
      const cx = x + size * 0.5;
      const cy = y + size * 0.5;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    if (grey < 0.998) {
      ctx.drawImage(sprite, x, y, size, size);
    }
    if (grey > 0.002 && stoneSprite) {
      ctx.globalAlpha = alpha * grey;
      ctx.drawImage(stoneSprite, x, y, size, size);
    }
    if (shimmer > 0.01) {
      ctx.globalAlpha = alpha * shimmer * 0.65;
      ctx.fillStyle = '#FFFFFF';
      const pad = size * CELL_PAD_RATIO;
      roundRectPath(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.1);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPieceSpritesAt(piece, centerX, centerY, cellSize, useTraySprites, options) {
    const startX = centerX - (piece.cols * cellSize) * 0.5;
    const startY = centerY - (piece.rows * cellSize) * 0.5;
    const sprite = useTraySprites ? sprites.trayGem[piece.color] : sprites.boardGem[piece.color];
    const stone = useTraySprites ? sprites.trayStone : sprites.boardStone;
    for (let i = 0; i < piece.cells.length; i++) {
      const c = piece.cells[i];
      blitTileSprite(sprite, stone, startX + c.c * cellSize, startY + c.r * cellSize, cellSize, options);
    }
  }

  function drawSparkleStar(x, y, radius, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ox = Math.cos(a) * radius;
      const oy = Math.sin(a) * radius;
      const ix = Math.cos(a + Math.PI / 4) * (radius * 0.24);
      const iy = Math.sin(a + Math.PI / 4) * (radius * 0.24);
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- Main Render & Update Loop ----
  let lastTime = performance.now();

  function hasActiveAnimations() {
    if (
      displayScore !== score ||
      Math.abs(greyProgress - greyTarget) > 0.002 ||
      traySpawnPop < 1 ||
      pendingClear !== null ||
      returningPieces.length > 0 ||
      beams.length > 0 ||
      particles.length > 0 ||
      popups.length > 0
    ) {
      return true;
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = board[r][c];
        if (cell && (cell.scale > 1.001 || cell.shimmer > 0.005)) return true;
      }
    }
    return false;
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (
      stageWrap.clientWidth > 0 &&
      stageWrap.clientHeight > 0 &&
      (Math.abs(stageWrap.clientWidth - layout.w) > 1 ||
        Math.abs(stageWrap.clientHeight - layout.h) > 1)
    ) {
      resizeCanvas();
    }

    // Smooth GPU-composited drag update (runs independent of board dirty state)
    if (drag) {
      drag.x = drag.targetX;
      drag.y = drag.targetY;
      if (drag.scale < 0.999) {
        drag.scale = lerp(drag.scale, 1.0, Math.min(1, dt * 24));
        if (drag.scale > 0.996) drag.scale = 1.0;
      }
      applyDragTransform();
      updateDragSnapState();
    }

    const animActive = update(dt);
    if (boardDirty || animActive) {
      render();
      boardDirty = false;
    }

    requestAnimationFrame(tick);
  }

  function update(dt) {
    let animating = false;

    if (displayScore < score) {
      const diff = score - displayScore;
      displayScore = Math.min(score, displayScore + Math.max(1, Math.ceil(diff * dt * 14)));
      scoreEl.textContent = String(displayScore);
      animating = true;
    } else if (displayScore > score) {
      displayScore = score;
      scoreEl.textContent = String(displayScore);
    }

    if (Math.abs(greyProgress - greyTarget) > 0.002) {
      const dir = greyTarget > greyProgress ? 1 : -1;
      greyProgress = Math.max(0, Math.min(1, greyProgress + dir * dt * 2.2));
      animating = true;
    } else {
      greyProgress = greyTarget;
    }

    if (traySpawnPop < 1) {
      traySpawnPop = Math.min(1, traySpawnPop + dt * 5.5);
      animating = true;
    }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = board[r][c];
        if (!cell) continue;
        if (cell.scale > 1) {
          cell.scale = Math.max(1, cell.scale - dt * 1.4);
          animating = true;
        }
        if (cell.shimmer > 0) {
          cell.shimmer = Math.max(0, cell.shimmer - dt * 2.0);
          animating = true;
        }
      }
    }

    if (pendingClear) {
      pendingClear.life += dt;
      animating = true;
      if (pendingClear.life >= pendingClear.duration) {
        finalizePendingClear();
      }
    }

    for (let i = returningPieces.length - 1; i >= 0; i--) {
      const rp = returningPieces[i];
      rp.t += dt * 6.5;
      animating = true;
      if (rp.t >= 1) {
        returningPieces.splice(i, 1);
        boardDirty = true;
      }
    }

    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].life += dt;
      animating = true;
      if (beams[i].life >= beams[i].maxLife) beams.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      animating = true;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life += dt;
      animating = true;
      if (popups[i].life >= popups[i].maxLife) popups.splice(i, 1);
    }

    return animating || hasActiveAnimations();
  }

  function render() {
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
    ctx.clearRect(0, 0, layout.w, layout.h);

    const cs = layout.cellSize;

    // 1. Blit Pre-rendered Static Board + 64 Recessed Cells + Tray Plaque in 1 call
    if (sprites.boardBg) {
      ctx.drawImage(sprites.boardBg, 0, 0, layout.w, layout.h);
    }

    const hoverClears = drag && drag.hover ? drag.previewClears : null;
    const hasHoverClear = Boolean(
      hoverClears && (hoverClears.fullRows.length > 0 || hoverClears.fullCols.length > 0)
    );

    // 2. Draw Placed Gem Tiles using Pre-rendered Offscreen Sprites
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = board[r][c];
        if (!cell) continue;
        const inHoverCluster =
          hasHoverClear && (hoverClears.rowSet.has(r) || hoverClears.colSet.has(c));
        const renderColor = inHoverCluster ? 0 : cell.color;
        blitTileSprite(
          sprites.boardGem[renderColor],
          sprites.boardStone,
          layout.gridX + c * cs,
          layout.gridY + r * cs,
          cs,
          {
            scale: cell.scale,
            grey: greyProgress,
            shimmer: inHoverCluster ? Math.max(cell.shimmer, 0.25) : cell.shimmer,
          }
        );
      }
    }

    // 3. Ghost Preview Shadow on Hover (color shifts cleanly without extra outer border)
    if (drag && drag.hover) {
      const { row, col } = drag.hover;
      const ghostColor = hasHoverClear ? 0 : drag.piece.color;
      const ghostAlpha = hasHoverClear ? 0.82 : 0.42;
      const ghostSprite = sprites.boardGem[ghostColor];

      for (let i = 0; i < drag.piece.cells.length; i++) {
        const cell = drag.piece.cells[i];
        blitTileSprite(
          ghostSprite,
          sprites.boardStone,
          layout.gridX + (col + cell.c) * cs,
          layout.gridY + (row + cell.r) * cs,
          cs,
          { alpha: ghostAlpha }
        );
      }
    }

    // 5. Line Clear Beams
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const prog = b.life / b.maxLife;
      const alpha = (1 - prog) * 0.85;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFFFFF';
      if (b.kind === 'row') {
        const shrink = cs * 0.35 * prog;
        roundRectPath(
          ctx,
          layout.gridX,
          layout.gridY + b.row * cs + shrink,
          layout.gridSize,
          Math.max(4, cs - shrink * 2),
          8
        );
        ctx.fill();
      } else if (b.kind === 'col') {
        const shrink = cs * 0.35 * prog;
        roundRectPath(
          ctx,
          layout.gridX + b.col * cs + shrink,
          layout.gridY,
          Math.max(4, cs - shrink * 2),
          layout.gridSize,
          8
        );
        ctx.fill();
      } else if (b.kind === 'area') {
        roundRectPath(ctx, b.x, b.y, b.w, b.h, 12);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Tray Pieces using Pre-rendered Tray Sprites
    const trayCellSize = cs * layout.trayCellScale;
    const popEase = 1 - Math.pow(1 - traySpawnPop, 3);
    for (let i = 0; i < 3; i++) {
      const piece = tray[i];
      if (!piece) continue;
      if (drag && drag.slotIndex === i) continue;
      if (returningPieces.some((rp) => rp.slotIndex === i)) continue;
      const center = layout.slotCenters[i];
      drawPieceSpritesAt(piece, center.x, center.y, trayCellSize * popEase, true, {
        grey: greyProgress,
      });
    }

    // Returning Pieces
    for (let i = 0; i < returningPieces.length; i++) {
      const rp = returningPieces[i];
      const ease = 1 - Math.pow(1 - rp.t, 3);
      const x = lerp(rp.fromX, rp.toX, ease);
      const y = lerp(rp.fromY, rp.toY, ease);
      const s = lerp(rp.fromScale, rp.toScale, ease);
      drawPieceSpritesAt(rp.piece, x, y, cs * s, false, { grey: greyProgress });
    }

    // 7. Shatter Particles & Sparkles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const prog = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - Math.pow(prog, 1.5));
      if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.8, 0);
        ctx.lineTo(0, p.size * 0.7);
        ctx.lineTo(-p.size * 0.7, p.size * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        drawSparkleStar(p.x, p.y, p.size * (1 - prog * 0.4), p.rot, p.color, alpha);
      }
    }

    // 8. Combo Callout & Floating Point Popups
    for (let i = 0; i < popups.length; i++) {
      const pop = popups[i];
      const t = pop.life / pop.maxLife;
      const popScale = t < 0.18 ? lerp(0.5, 1.15, t / 0.18) : t < 0.3 ? lerp(1.15, 1.0, (t - 0.18) / 0.12) : 1.0;
      const rise = t * 28;
      const alpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);

      ctx.save();
      ctx.translate(pop.x, pop.y - rise);
      ctx.scale(popScale, popScale);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fontSize = Math.round(Math.max(24, cs * 0.76));
      if (pop.label) {
        ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const grad = ctx.createLinearGradient(0, -fontSize * 0.6, 0, fontSize * 0.4);
        grad.addColorStop(0, pop.colors[0]);
        grad.addColorStop(1, pop.colors[1]);

        ctx.lineWidth = 6;
        ctx.strokeStyle = '#1B0E24';
        ctx.strokeText(pop.label, 0, -10);
        ctx.fillStyle = grad;
        ctx.fillText(pop.label, 0, -10);
      }

      const ptSize = Math.round(Math.max(19, cs * 0.56));
      const ptY = pop.label ? fontSize * 0.62 : 0;
      ctx.font = `900 ${ptSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#112536';
      ctx.strokeText(pop.points, 0, ptY);
      ctx.fillStyle = '#4EF2FF';
      ctx.fillText(pop.points, 0, ptY);

      ctx.restore();
    }
  }

  // ---- UI Button Wiring ----
  startPlayBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    global.GemAudio.playUiClick();
    global.GemAudio.playRevive();
    startNewGame();
  });

  startContinueBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    global.GemAudio.playUiClick();
    resumeCurrentGame();
  });

  startNewGameBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    global.GemAudio.playUiClick();
    global.GemAudio.playRevive();
    startNewGame();
  });

  homeSoundBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    const muted = global.GemAudio.toggleMute();
    syncSoundUi();
    if (!muted) global.GemAudio.playUiClick();
  });

  howToPlayBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    global.GemAudio.playUiClick();
    howtoOverlay.classList.remove('hidden');
  });

  howtoCloseBtn.addEventListener('click', () => {
    global.GemAudio.playUiClick();
    howtoOverlay.classList.add('hidden');
  });

  pauseBtn.addEventListener('click', () => {
    global.GemAudio.unlock();
    openPauseMenu();
  });

  resumeBtn.addEventListener('click', () => {
    closePauseMenu();
  });

  soundToggleBtn.addEventListener('click', () => {
    const muted = global.GemAudio.toggleMute();
    syncSoundUi();
    if (!muted) global.GemAudio.playUiClick();
  });

  pauseRestartBtn.addEventListener('click', () => {
    global.GemAudio.playUiClick();
    startNewGame();
  });

  pauseHomeBtn.addEventListener('click', () => {
    global.GemAudio.playUiClick();
    saveGameState();
    showHomeScreen();
  });

  watchAdBtn.addEventListener('click', () => {
    if (gameState !== 'CONTINUE_PROMPT') return;
    global.GemAudio.playUiClick();
    continueOverlay.classList.add('hidden');
    gameState = 'REWARDED_AD';
    let rewardEarned = false;
    global.AdManager.showRewarded(
      () => {
        rewardEarned = true;
        handleReviveReward();
      },
      () => {
        if (!rewardEarned && gameState === 'REWARDED_AD') {
          gameState = 'CONTINUE_PROMPT';
          continueOverlay.classList.remove('hidden');
        }
      }
    );
  });

  declineContinueBtn.addEventListener('click', () => {
    if (gameState !== 'CONTINUE_PROMPT') return;
    global.GemAudio.playUiClick();
    showGameOverScreen();
  });

  playAgainBtn.addEventListener('click', () => {
    global.GemAudio.playUiClick();
    startNewGame();
  });

  gameoverHomeBtn.addEventListener('click', () => {
    global.GemAudio.playUiClick();
    clearSavedGameState();
    resetFreshRunData();
    showHomeScreen();
  });

  // ---- AdMob / Android WebView Bridge Hooks ----
  global.__isAdCalmScreen = function () {
    return (gameState === 'START' || gameState === 'PAUSED' || gameState === 'GAME_OVER') && !drag;
  };

  global.__onAdLayoutChanged = function () {
    resizeCanvas();
  };

  global.onShowBannerAd = function () {
    if (global.AdManager) {
      global.AdManager.showBanner();
    }
  };

  global.onHideBannerAd = function () {
    if (global.AdManager) {
      global.AdManager.hideBanner();
    }
  };

  global.onShowRewardedAd = function (onRewardComplete) {
    if (global.AdManager) {
      global.AdManager.showRewarded(onRewardComplete);
    }
  };

  global.handleAndroidBack = function () {
    if (!howtoOverlay.classList.contains('hidden')) {
      howtoOverlay.classList.add('hidden');
      return true;
    }
    if (gameState === 'PLAYING') {
      openPauseMenu();
      return true;
    }
    if (gameState === 'PAUSED') {
      closePauseMenu();
      return true;
    }
    return false;
  };

  // ---- Lifecycle & State Persistence ----
  function persistOnBackground() {
    if (pendingClear) {
      finalizePendingClear();
    }
    if (gameState !== 'GAME_OVER' && hasLiveProgress()) {
      saveGameState();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistOnBackground();
    }
  });
  window.addEventListener('pagehide', persistOnBackground);
  window.addEventListener('beforeunload', persistOnBackground);

  function initFromStorage() {
    const saved = loadSavedGameState();
    if (saved) {
      board = saved.board;
      tray = saved.tray;
      if (tray.every((item) => item === null)) {
        refillTray();
      }
      score = saved.score;
      displayScore = saved.score;
      runStartBest = saved.runStartBest;
      consecutiveClears = saved.consecutiveClears;
      bigClearStreak = saved.bigClearStreak;
      hasRevived = saved.hasRevived;
      pendingClear = null;
      drag = null;
      hideDragLayer();
      syncHudImmediate();
      syncSoundUi();

      if (saved.pendingContinue) {
        greyProgress = 1;
        greyTarget = 1;
        gameState = 'CONTINUE_PROMPT';
        hideAllModals();
        continueOverlay.classList.remove('hidden');
        boardDirty = true;
      } else {
        greyProgress = 0;
        greyTarget = 0;
        showHomeScreen();
      }
    } else {
      resetFreshRunData();
      showHomeScreen();
    }
  }

  // ---- Initialization ----
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(stageWrap);
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('load', resizeCanvas);

  resizeCanvas();
  if (global.AdManager) {
    global.AdManager.init(global.AD_CONFIG);
  }
  initFromStorage();
  if (global.AdManager) {
    global.AdManager.showBanner();
  }
  requestAnimationFrame(tick);
})(window);
