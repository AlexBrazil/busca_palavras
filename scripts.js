const ORIENTATIONS = [
  { name: "horizontal", delta: [0, 1] },
  { name: "horizontalBack", delta: [0, -1] },
  { name: "vertical", delta: [1, 0] },
  { name: "verticalUp", delta: [-1, 0] },
  { name: "diagonal", delta: [1, 1] },
  { name: "diagonalBack", delta: [1, -1] },
  { name: "diagonalUp", delta: [-1, 1] },
  { name: "diagonalUpBack", delta: [-1, -1] }
];

const DEFAULT_L10N = {
  check: "Corrigir",
  tryAgain: "Repetir",
  showSolution: "Mostrar solu\u00e7\u00e3o",
  found: "@found de @totalWords encontrada(s)",
  timeSpent: "Tempo gasto",
  score: "Voc\u00ea conseguiu @score de @total pontos",
  wordListHeader: "Palavras",
  invalidSelection: "Caminho nao corresponde a nenhuma palavra.",
  fullscreenEnter: "Tela cheia",
  fullscreenExit: "Sair da tela cheia"
};

const DEFAULT_BEHAVIOUR = {
  orientations: {
    horizontal: true,
    horizontalBack: true,
    vertical: true,
    verticalUp: true,
    diagonal: true,
    diagonalBack: true,
    diagonalUp: true,
    diagonalUpBack: true
  },
  fillPool: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  preferOverlap: true,
  showVocabulary: true,
  enableShowSolution: true,
  enableRetry: true
};

const DEFAULT_INSTRUCTIONS = {
  enabled: true,
  showOnLoad: true,
  showOnRestart: false,
  eyebrow: "Preparado?",
  title: "Antes de comecar",
  body: [
    "Leia a dica exibida e procure a palavra correta na grade.",
    "Arraste o mouse ou o dedo para selecionar todas as letras na ordem."
  ],
  steps: [
    "Clique em Corrigir para conferir o progresso.",
    "Use Mostrar solucao apenas se precisar de ajuda extra."
  ],
  startButtonLabel: "Iniciar"
};

const state = {
  behaviour: null,
  l10n: DEFAULT_L10N,
  mode: "palavra",
  instructions: {
    ...DEFAULT_INSTRUCTIONS,
    body: [...DEFAULT_INSTRUCTIONS.body],
    steps: [...DEFAULT_INSTRUCTIONS.steps]
  },
  entries: [],
  gridLetters: [],
  cellElements: [],
  wordData: [],
  wordLookup: new Map(),
  foundCount: 0,
  timerId: null,
  elapsedSeconds: 0,
  locked: false,
  feedbackMessage: "",
  feedbackTimerId: null,
  lastPointerType: "mouse",
  accessibility: {
    vlibras: {
      desktop: false,
      mobile: false
    },
    vlibrasInjected: false,
    vlibrasScriptLoaded: false,
    vlibrasWidget: null
  },
  timeLimitSeconds: null,
  timerExpired: false,
  previousFocus: null,
  introPreviousFocus: null,
  introVisible: false,
  playStarted: true,
  isFullscreen: false,
  fullscreenSupported: false,
  selection: {
    active: false,
    pointerId: null,
    pointerType: null,
    start: null,
    path: [],
    cells: [],
    captureTarget: null,
    dragged: false
  },
  tapSelection: null
};

const elements = {
  app: document.getElementById("app"),
  grid: document.getElementById("grid"),
  vocabulary: document.getElementById("vocabulary"),
  wordList: document.getElementById("word-list"),
  taskDescription: document.getElementById("task-description"),
  vocabularyTitle: document.getElementById("vocabulary-title"),
  timerLabel: document.getElementById("timer-label"),
  timerValue: document.getElementById("timer-value"),
  counterLabel: document.getElementById("counter-label"),
  counterValue: document.getElementById("counter-value"),
  checkBtn: document.getElementById("check-btn"),
  showSolutionBtn: document.getElementById("show-solution-btn"),
  retryBtn: document.getElementById("retry-btn"),
  feedback: document.getElementById("feedback"),
  wordTemplate: document.getElementById("word-item-template"),
  timeLimitModal: document.querySelector('[data-modal="time-limit"]'),
  timeLimitRetryBtn: document.getElementById("time-limit-retry-btn"),
  timeLimitCloseBtn: document.getElementById("time-limit-close-btn"),
  fullscreenBtn: document.getElementById("fullscreen-btn"),
  fullscreenLabel: document.getElementById("fullscreen-label"),
  introPanel: document.querySelector("[data-intro-panel]"),
  introEyebrow: document.getElementById("intro-panel-eyebrow"),
  introTitle: document.getElementById("intro-panel-title"),
  introDescription: document.getElementById("intro-panel-description"),
  introList: document.getElementById("intro-panel-list"),
  introStartBtn: document.getElementById("intro-start-btn"),
  introStartLabel: document.getElementById("intro-start-label")
};

init().catch((error) => {
  console.error(error);
  elements.feedback.textContent = "Erro ao inicializar o jogo.";
  elements.feedback.dataset.visible = "true";
  state.locked = true;
});

async function init() {
  const data = await loadConfig();
  setupConfig(data);
  setupUI();
  setupFullscreenControls();
  setupInstructionPanel();
  setupAccessibilityFeatures();
  attachEventListeners();
  startRound(shouldShowIntroOnLoad());
}

async function loadConfig() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar data.json (${response.status})`);
  }
  return response.json();
}

function setupConfig(config) {
  state.l10n = { ...DEFAULT_L10N, ...(config?.l10n || {}) };
  state.instructions = parseInstructionsConfig(config?.instructions);
  state.behaviour = mergeBehaviour(config?.behaviour || {});
  state.timeLimitSeconds = parseTimeLimitSeconds(state.behaviour.timeLimitSeconds);

  const requestedMode =
    typeof config?.mode === "string" ? config.mode.trim().toLowerCase() : "palavra";
  state.mode = requestedMode === "dica" ? "dica" : "palavra";

  if (state.mode === "dica" && !state.behaviour.showVocabulary) {
    state.behaviour.showVocabulary = true;
  }

  state.accessibility = {
    ...state.accessibility,
    ...parseAccessibilityConfig(config?.accessibility)
  };

  state.entries = normalizeEntries(config?.wordList, state.mode);
  if (state.entries.length === 0) {
    throw new Error("Lista de palavras vazia.");
  }

  const description = config?.taskDescription?.trim();
  elements.taskDescription.textContent =
    description || "Encontre todas as palavras na grade.";
  elements.app.dataset.mode = state.mode;
}

function mergeBehaviour(customBehaviour) {
  const merged = {
    ...DEFAULT_BEHAVIOUR,
    ...customBehaviour,
    orientations: {
      ...DEFAULT_BEHAVIOUR.orientations,
      ...(customBehaviour.orientations || {})
    }
  };

  if (!merged.fillPool || typeof merged.fillPool !== "string") {
    merged.fillPool = DEFAULT_BEHAVIOUR.fillPool;
  }

  return merged;
}

function parseAccessibilityConfig(accessibilityConfig) {
  const defaults = {
    vlibras: {
      desktop: false,
      mobile: false
    }
  };

  if (!accessibilityConfig || typeof accessibilityConfig !== "object") {
    return defaults;
  }

  const vlibras = accessibilityConfig.vlibras;
  return {
    vlibras: {
      desktop: Boolean(vlibras && vlibras.desktop),
      mobile: Boolean(vlibras && vlibras.mobile)
    }
  };
}

function parseTimeLimitSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function parseInstructionsConfig(instructionsConfig) {
  const defaults = cloneInstructionDefaults();
  if (!instructionsConfig || typeof instructionsConfig !== "object") {
    return defaults;
  }

  const enabled = instructionsConfig.enabled === false ? false : true;
  const showOnLoad =
    instructionsConfig.showOnLoad === false ? false : defaults.showOnLoad;
  const showOnRestart = Boolean(instructionsConfig.showOnRestart);

  const eyebrow = resolveTextValue(instructionsConfig.eyebrow, defaults.eyebrow);
  const title = resolveTextValue(instructionsConfig.title, defaults.title);
  const bodySource =
    instructionsConfig.body ||
    instructionsConfig.description ||
    instructionsConfig.content ||
    defaults.body;
  const stepsSource =
    instructionsConfig.steps !== undefined ? instructionsConfig.steps : defaults.steps;
  const body = normalizeTextArray(bodySource);
  const steps = normalizeTextArray(stepsSource);
  const startButtonLabel = resolveTextValue(
    instructionsConfig.startButtonLabel,
    defaults.startButtonLabel
  );

  if (!enabled) {
    return {
      ...defaults,
      enabled: false,
      showOnLoad: false,
      showOnRestart: false,
      eyebrow,
      title,
      body: body.length > 0 ? body : defaults.body,
      steps: steps.length > 0 ? steps : [],
      startButtonLabel
    };
  }

  return {
    enabled: true,
    showOnLoad,
    showOnRestart,
    eyebrow,
    title,
    body: body.length > 0 ? body : defaults.body,
    steps,
    startButtonLabel
  };
}

function cloneInstructionDefaults() {
  return {
    ...DEFAULT_INSTRUCTIONS,
    body: [...DEFAULT_INSTRUCTIONS.body],
    steps: [...DEFAULT_INSTRUCTIONS.steps]
  };
}

function normalizeTextArray(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function resolveTextValue(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

function normalizeEntries(wordList, mode) {
  let source = wordList;

  if (typeof source === "string") {
    source = source
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(source)) {
    return [];
  }

  const entries = [];
  const seen = new Set();

  source.forEach((item) => {
    let wordText = "";
    let hintText = "";

    if (typeof item === "string") {
      wordText = item;
    } else if (item && typeof item === "object") {
      if (typeof item.word === "string") {
        wordText = item.word;
      }
      if (typeof item.hint === "string") {
        hintText = item.hint;
      }
    }

    const trimmedWord = wordText.trim();
    if (!trimmedWord) {
      return;
    }

    const normalizedWord = trimmedWord.toLocaleUpperCase("pt-BR");
    if (seen.has(normalizedWord)) {
      return;
    }

    const normalizedHint = hintText.trim();
    if (mode === "dica" && normalizedHint.length === 0) {
      throw new Error(
        `O modo 'dica' exige fornecer uma dica para a palavra '${trimmedWord}'.`
      );
    }

    const entry = {
      word: normalizedWord,
      hint: normalizedHint,
      placement: null,
      listItem: null,
      solutionEl: null,
      statusEl: null,
      status: "pending",
      found: false,
      solved: false
    };

    entries.push(entry);
    seen.add(normalizedWord);
  });

  return entries;
}

function setupUI() {
  elements.app.dataset.state = "ready";

  const checkLabel = elements.checkBtn.querySelector(".btn__label");
  const solutionLabel = elements.showSolutionBtn.querySelector(".btn__label");
  const retryLabel = elements.retryBtn.querySelector(".btn__label");

  const checkText = state.l10n.check;
  const solutionText = state.l10n.showSolution;
  const retryText = state.l10n.tryAgain;

  if (checkLabel) {
    checkLabel.textContent = checkText;
  } else {
    elements.checkBtn.textContent = checkText;
  }
  elements.checkBtn.setAttribute("aria-label", checkText);
  elements.checkBtn.setAttribute("title", checkText);

  if (solutionLabel) {
    solutionLabel.textContent = solutionText;
  } else {
    elements.showSolutionBtn.textContent = solutionText;
  }
  elements.showSolutionBtn.setAttribute("aria-label", solutionText);
  elements.showSolutionBtn.setAttribute("title", solutionText);

  if (retryLabel) {
    retryLabel.textContent = retryText;
  } else {
    elements.retryBtn.textContent = retryText;
  }
  elements.retryBtn.setAttribute("aria-label", retryText);
  elements.retryBtn.setAttribute("title", retryText);

  elements.timerLabel.textContent = state.l10n.timeSpent;
  elements.vocabularyTitle.textContent = state.l10n.wordListHeader;
  elements.wordList.setAttribute("aria-live", "polite");

  if (!state.behaviour.showVocabulary) {
    elements.vocabulary.setAttribute("hidden", "true");
  } else {
    elements.vocabulary.removeAttribute("hidden");
  }

  if (!state.behaviour.enableShowSolution) {
    elements.showSolutionBtn.setAttribute("hidden", "true");
  } else {
    elements.showSolutionBtn.removeAttribute("hidden");
    elements.showSolutionBtn.disabled = false;
  }

  if (!state.behaviour.enableRetry) {
    elements.retryBtn.setAttribute("hidden", "true");
  } else {
    elements.retryBtn.removeAttribute("hidden");
    elements.retryBtn.disabled = false;
  }

  updateFullscreenButton();
  updateFeedback("");
}

function setupFullscreenControls() {
  if (!elements.fullscreenBtn) {
    return;
  }

  state.fullscreenSupported = supportsFullscreen();

  if (!state.fullscreenSupported) {
    updateFullscreenButton();
    elements.fullscreenBtn.disabled = true;
    elements.fullscreenBtn.setAttribute("aria-disabled", "true");
    elements.fullscreenBtn.setAttribute("title", "Modo tela cheia indispon\u00edvel.");
    return;
  }

  elements.fullscreenBtn.disabled = false;
  elements.fullscreenBtn.removeAttribute("aria-disabled");
  elements.fullscreenBtn.addEventListener("click", handleFullscreenToggle);

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);

  updateFullscreenButton();
}

function supportsFullscreen() {
  if (typeof document === "undefined") {
    return false;
  }
  return Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
  );
}

function updateFullscreenButton() {
  if (!elements.fullscreenBtn) {
    return;
  }
  const active = isFullscreenActive();
  const labelText = active ? state.l10n.fullscreenExit : state.l10n.fullscreenEnter;
  elements.fullscreenBtn.dataset.state = active ? "exit" : "enter";
  if (elements.fullscreenLabel) {
    elements.fullscreenLabel.textContent = labelText;
  } else {
    elements.fullscreenBtn.textContent = labelText;
  }
  elements.fullscreenBtn.setAttribute("aria-label", labelText);
  elements.fullscreenBtn.setAttribute("title", labelText);
  if (!state.fullscreenSupported) {
    elements.fullscreenBtn.disabled = true;
  }
}

function setupInstructionPanel() {
  if (!elements.introPanel) {
    return;
  }
  if (!state.instructions.enabled) {
    hideInstructionPanel();
    return;
  }
  renderInstructionPanel();
}

function renderInstructionPanel() {
  if (!elements.introPanel || !state.instructions.enabled) {
    return;
  }
  const { eyebrow, title, body, steps, startButtonLabel } = state.instructions;
  if (elements.introEyebrow) {
    elements.introEyebrow.textContent = eyebrow;
  }
  if (elements.introTitle) {
    elements.introTitle.textContent = title;
  }
  if (elements.introDescription) {
    elements.introDescription.innerHTML = "";
    body.forEach((paragraph) => {
      const text = paragraph.trim();
      if (!text) {
        return;
      }
      const p = document.createElement("p");
      p.textContent = text;
      elements.introDescription.appendChild(p);
    });
  }
  if (elements.introList) {
    elements.introList.innerHTML = "";
    if (!steps || steps.length === 0) {
      elements.introList.hidden = true;
    } else {
      elements.introList.hidden = false;
      steps.forEach((value) => {
        const content = value.trim();
        if (!content) {
          return;
        }
        const item = document.createElement("li");
        item.textContent = content;
        elements.introList.appendChild(item);
      });
    }
  }
  if (elements.introStartLabel) {
    elements.introStartLabel.textContent = startButtonLabel;
  }
}

function shouldShowIntroOnLoad() {
  return Boolean(state.instructions.enabled && state.instructions.showOnLoad);
}

function shouldShowIntroOnRestart() {
  return Boolean(state.instructions.enabled && state.instructions.showOnRestart);
}

function startRound(showIntro) {
  state.playStarted = !showIntro;
  startNewGame();
  if (showIntro && state.instructions.enabled) {
    openInstructionPanel();
  } else {
    hideInstructionPanel();
  }
}

function openInstructionPanel() {
  if (!elements.introPanel || !state.instructions.enabled) {
    return;
  }
  state.introVisible = true;
  state.introPreviousFocus =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;
  elements.introPanel.hidden = false;
  if (elements.app) {
    elements.app.setAttribute("data-intro-open", "true");
  }
  setGridDisabledState(true);
  state.locked = true;
  toggleButtons(false);
  stopTimer();
  window.setTimeout(() => {
    if (elements.introStartBtn && typeof elements.introStartBtn.focus === "function") {
      elements.introStartBtn.focus();
    }
  }, 0);
}

function closeInstructionPanel() {
  if (!state.introVisible || !elements.introPanel) {
    return;
  }
  state.introVisible = false;
  elements.introPanel.hidden = true;
  if (elements.app) {
    elements.app.removeAttribute("data-intro-open");
  }
  state.playStarted = true;
  state.locked = false;
  setGridDisabledState(false);
  toggleButtons(true);
  startTimer();
  focusFirstGridCell();
  state.introPreviousFocus = null;
}

function hideInstructionPanel() {
  if (!elements.introPanel) {
    return;
  }
  elements.introPanel.hidden = true;
  if (elements.app) {
    elements.app.removeAttribute("data-intro-open");
  }
  state.introVisible = false;
  state.introPreviousFocus = null;
}

function setGridDisabledState(disabled) {
  if (!elements.grid) {
    return;
  }
  if (disabled) {
    elements.grid.setAttribute("aria-disabled", "true");
  } else {
    elements.grid.removeAttribute("aria-disabled");
  }
}

function focusFirstGridCell() {
  if (!Array.isArray(state.cellElements) || state.cellElements.length === 0) {
    return;
  }
  const firstRow = state.cellElements.find((row) => Array.isArray(row) && row.length > 0);
  if (!firstRow) {
    return;
  }
  const firstCell = firstRow.find((cell) => cell);
  if (firstCell && typeof firstCell.focus === "function") {
    firstCell.focus();
  }
}

function setupAccessibilityFeatures() {
  if (shouldLoadVlibras()) {
    injectVlibrasWidget();
  }
}

function attachEventListeners() {
  elements.grid.addEventListener("pointerdown", handlePointerDown);
  elements.checkBtn.addEventListener("click", handleCheck);
  elements.showSolutionBtn.addEventListener("click", handleShowSolution);
  elements.retryBtn.addEventListener("click", handleRetry);
  if (elements.introStartBtn) {
    elements.introStartBtn.addEventListener("click", handleIntroStart);
  }
  if (elements.timeLimitRetryBtn) {
    elements.timeLimitRetryBtn.addEventListener("click", handleTimeLimitRetry);
  }
  if (elements.timeLimitCloseBtn) {
    elements.timeLimitCloseBtn.addEventListener("click", handleTimeLimitClose);
  }
}

function handleFullscreenToggle(event) {
  event.preventDefault();
  if (!state.fullscreenSupported) {
    return;
  }
  const target = elements.app || document.documentElement;
  if (!isFullscreenActive()) {
    const request = requestFullscreen(target);
    if (request && typeof request.catch === "function") {
      request.catch((error) => {
        console.warn("Falha ao entrar em modo tela cheia.", error);
      });
    }
    return;
  }
  const exit = exitFullscreen();
  if (exit && typeof exit.catch === "function") {
    exit.catch((error) => {
      console.warn("Falha ao sair do modo tela cheia.", error);
    });
  }
}

function handleFullscreenChange() {
  state.isFullscreen = isFullscreenActive();
  updateFullscreenButton();
}

function requestFullscreen(target) {
  if (!target) {
    return null;
  }
  if (target.requestFullscreen) {
    return target.requestFullscreen();
  }
  if (target.webkitRequestFullscreen) {
    return target.webkitRequestFullscreen();
  }
  if (target.mozRequestFullScreen) {
    return target.mozRequestFullScreen();
  }
  if (target.msRequestFullscreen) {
    return target.msRequestFullscreen();
  }
  return null;
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  }
  if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  }
  if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen();
  }
  if (document.msExitFullscreen) {
    return document.msExitFullscreen();
  }
  return null;
}

function isFullscreenActive() {
  if (typeof document === "undefined") {
    return false;
  }
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
  );
}

function startNewGame() {
  state.locked = !state.playStarted;
  state.foundCount = 0;
  state.timerExpired = false;
  closeTimeLimitModal();
  setGridDisabledState(state.locked);
  state.entries.forEach((entry) => {
    entry.placement = null;
    entry.listItem = null;
    entry.solutionEl = null;
    entry.statusEl = null;
    entry.status = "pending";
    entry.found = false;
    entry.solved = false;
  });
  clearSelection();
  clearTapSelection();
  stopTimer();
  updateFeedback("");

  const puzzle = generatePuzzle(state.entries, state.behaviour);
  state.gridLetters = puzzle.grid;
  state.wordData = puzzle.wordPlacements;
  state.wordLookup = buildWordLookup(state.wordData);

  renderGrid(puzzle);
  state.cellElements = puzzle.cellMatrix;
  renderVocabulary();

  updateCounter();
  resetTimer();
  toggleButtons(state.playStarted);
  if (state.playStarted) {
    startTimer();
  } else {
    stopTimer();
  }
}

function toggleButtons(enabled) {
  const shouldDisable = !enabled || state.timerExpired;
  elements.checkBtn.disabled = shouldDisable;
  if (state.behaviour.enableShowSolution) {
    elements.showSolutionBtn.disabled = shouldDisable;
  }
  if (state.behaviour.enableRetry) {
    elements.retryBtn.disabled = false;
  }
}

function generatePuzzle(entries, behaviour) {
  const orientations = ORIENTATIONS.filter(
    (orientation) => behaviour.orientations[orientation.name]
  );

  if (orientations.length === 0) {
    throw new Error("Nenhuma orientação disponível para montar o caça-palavras.");
  }

  const wordEntries = entries.map((entry) => ({
    entry,
    word: entry.word
  }));

  const sortedWords = [...wordEntries].sort((a, b) => b.word.length - a.word.length);

  const longest = sortedWords[0].word.length;
  const totalLetters = sortedWords.reduce((sum, item) => sum + item.word.length, 0);
  const baseSize = Math.max(longest, Math.ceil(Math.sqrt(totalLetters)) + 1);
  const maxSize = Math.max(baseSize, longest + 4, 12);

  const preferOverlap = Boolean(behaviour.preferOverlap);
  const fillPool = prepareFillPool(behaviour.fillPool);

  for (let size = baseSize; size <= maxSize; size += 1) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const grid = createEmptyGrid(size);
      const placements = [];

      let failed = false;
      const workingWords = shuffle([...sortedWords]);

      for (const { entry, word } of workingWords) {
        const placement = placeWord(word, grid, orientations, preferOverlap);
        if (!placement) {
          failed = true;
          break;
        }
        placement.entry = entry;
        entry.placement = placement;
        placements.push(placement);
        applyPlacement(grid, placement);
      }

      if (!failed) {
        const filledGrid = fillRemainingCells(grid, fillPool);
        const cellMatrix = buildCellMatrix(size);
        return {
          grid: filledGrid,
          size,
          wordPlacements: placements,
          cellMatrix
        };
      }
    }
  }

  throw new Error("N\u00e3o foi poss\u00edvel posicionar todas as palavras na grade.");
}

function prepareFillPool(pool) {
  const cleaned = typeof pool === "string" && pool.trim().length > 0 ? pool : DEFAULT_BEHAVIOUR.fillPool;
  const letters = cleaned
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return letters.length > 0 ? letters : DEFAULT_BEHAVIOUR.fillPool;
}

function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function buildCellMatrix(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function fillRemainingCells(grid, pool) {
  const letters = grid.map((row) =>
    row.map((cell) => cell || pool[Math.floor(Math.random() * pool.length)])
  );
  return letters;
}

function placeWord(word, grid, orientations, preferOverlap) {
  const size = grid.length;
  const placements = [];

  for (const orientation of shuffle([...orientations])) {
    const [dr, dc] = orientation.delta;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const candidate = evaluatePlacement(word, grid, row, col, dr, dc);
        if (candidate) {
          placements.push({ ...candidate, orientation: orientation.name });
        }
      }
    }
  }

  if (placements.length === 0) {
    return null;
  }

  let candidates = placements;

  if (preferOverlap) {
    const maxOverlap = Math.max(...placements.map((item) => item.overlap));
    candidates = placements.filter((item) => item.overlap === maxOverlap);
  }

  return randomChoice(candidates);
}

function evaluatePlacement(word, grid, startRow, startCol, dr, dc) {
  const size = grid.length;
  const endRow = startRow + dr * (word.length - 1);
  const endCol = startCol + dc * (word.length - 1);

  if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
    return null;
  }

  let overlap = 0;
  const path = [];

  for (let index = 0; index < word.length; index += 1) {
    const row = startRow + dr * index;
    const col = startCol + dc * index;
    const current = grid[row][col];
    const letter = word[index];

    if (current && current !== letter) {
      return null;
    }

    if (current === letter) {
      overlap += 1;
    }
    path.push({ row, col });
  }

  return {
    word,
    start: { row: startRow, col: startCol },
    end: { row: endRow, col: endCol },
    path,
    overlap
  };
}

function applyPlacement(grid, placement) {
  placement.path.forEach(({ row, col }, index) => {
    grid[row][col] = placement.word[index];
  });
}

function buildWordLookup(wordPlacements) {
  const lookup = new Map();
  wordPlacements.forEach((placement) => {
    placement.found = false;
    placement.solved = false;
    placement.listItem = null;
    placement.solutionEl = null;
     placement.statusEl = null;
    if (placement.entry) {
      placement.entry.found = false;
      placement.entry.solved = false;
    }
    const straight = placement.word;
    const reversed = reverseString(straight);
    lookup.set(straight, placement);
    lookup.set(reversed, placement);
  });
  return lookup;
}

function renderGrid(puzzle) {
  const { grid, size, cellMatrix } = puzzle;
  elements.grid.innerHTML = "";
  elements.grid.style.setProperty("--grid-size", String(size));
  elements.grid.setAttribute("aria-rowcount", String(size));
  elements.grid.setAttribute("aria-colcount", String(size));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "grid__cell";
      cell.textContent = grid[row][col];
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.status = "default";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-rowindex", String(row + 1));
      cell.setAttribute("aria-colindex", String(col + 1));
      cell.setAttribute("aria-selected", "false");
      cell.setAttribute(
        "aria-label",
        `Letra ${grid[row][col]} na linha ${row + 1}, coluna ${col + 1}`
      );
      elements.grid.append(cell);
      cellMatrix[row][col] = cell;
    }
  }
}

function renderVocabulary() {
  elements.wordList.innerHTML = "";

  if (!state.behaviour.showVocabulary) {
    return;
  }

  state.entries.forEach((entry) => {
    const placement = entry.placement;
    if (!placement) {
      return;
    }

    const item = elements.wordTemplate.content.firstElementChild.cloneNode(true);
    item.classList.toggle("word-item--hint", state.mode === "dica");
    item.dataset.revealed = "false";
    item.dataset.status = "pending";

    const label = item.querySelector(".word-item__label");
    label.textContent = state.mode === "dica" ? entry.hint : entry.word;

    let solutionEl = null;
    if (state.mode === "dica") {
      solutionEl = document.createElement("span");
      solutionEl.className = "word-item__solution";
      solutionEl.textContent = entry.word;
      solutionEl.hidden = true;
      label.insertAdjacentElement("afterend", solutionEl);
    }

    const statusSpan = document.createElement("span");
    statusSpan.className = "visually-hidden word-item__status";
    statusSpan.textContent = getStatusMessage("pending");
    item.appendChild(statusSpan);

    placement.listItem = item;
    placement.solutionEl = solutionEl;
    placement.statusEl = statusSpan;
    entry.listItem = item;
    entry.solutionEl = solutionEl;
    entry.statusEl = statusSpan;
    entry.status = "pending";

    item.setAttribute("aria-label", buildWordAria(entry, "pending"));
    elements.wordList.append(item);
    updateWordAccessibility(placement, "pending");
  });
}

function handlePointerDown(event) {
  if (state.locked) {
    return;
  }

  const cell = event.target.closest(".grid__cell");
  if (!cell) {
    return;
  }

  event.preventDefault();
  if (typeof cell.focus === "function") {
    cell.focus();
  }

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const pointerType = event.pointerType || "mouse";

  if (pointerType !== "touch") {
    clearTapSelection();
  }

  state.selection.pointerType = pointerType;
  state.selection.active = true;
  state.selection.pointerId = event.pointerId;
  state.selection.start = { row, col };
  state.selection.path = [{ row, col }];
  state.selection.cells = [cell];
  state.selection.captureTarget = null;
  state.selection.dragged = false;
  state.lastPointerType = pointerType;

  if (typeof cell.setPointerCapture === "function" && event.pointerId != null) {
    try {
      cell.setPointerCapture(event.pointerId);
      state.selection.captureTarget = cell;
    } catch (error) {
      state.selection.captureTarget = null;
    }
  }

  applyPreview([cell]);

  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerCancel);
}

function handlePointerMove(event) {
  if (!state.selection.active || event.pointerId !== state.selection.pointerId) {
    return;
  }

  state.selection.dragged = true;
  if (state.selection.pointerType === "touch") {
    clearTapSelection();
  }

  event.preventDefault();
  const cell = getCellAtPoint(event.clientX, event.clientY);
  if (!cell) {
    updateSelectionPath(null);
    return;
  }
  updateSelectionPath(cell);
}

function handlePointerUp(event) {
  if (!state.selection.active || event.pointerId !== state.selection.pointerId) {
    return;
  }

  const wasTap =
    state.selection.pointerType === "touch" && !state.selection.dragged;

  if (wasTap) {
    const releaseCell =
      getCellAtPoint(event.clientX, event.clientY) ||
      state.selection.cells[state.selection.cells.length - 1] ||
      null;
    const releaseCoords = releaseCell
      ? {
          row: Number(releaseCell.dataset.row),
          col: Number(releaseCell.dataset.col)
        }
      : state.selection.start;

    if (state.tapSelection) {
      const anchor = state.tapSelection;
      clearTapSelection();
      const anchorPosition = { row: anchor.row, col: anchor.col };
      const path = computeStraightPath(anchorPosition, releaseCoords);
      if (!path || path.length <= 1) {
        clearSelection();
        if (
          releaseCoords &&
          releaseCoords.row === anchorPosition.row &&
          releaseCoords.col === anchorPosition.col
        ) {
          return;
        }
        setTapSelection(anchorPosition);
        showSelectionError();
        return;
      }
      state.selection.start = anchorPosition;
      state.selection.path = path;
      const cells = path.map((position) => getCellNode(position.row, position.col));
      applyPreview(cells);
      finalizeSelection();
      return;
    }

    const start = state.selection.start;
    clearSelection();
    setTapSelection(start);
    return;
  }

  finalizeSelection();
}

function handlePointerCancel() {
  clearSelection();
}

function getCellAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  if (!element) {
    return null;
  }
  return element.classList.contains("grid__cell")
    ? element
    : element.closest(".grid__cell");
}

function updateSelectionPath(targetCell) {
  const start = state.selection.start;
  if (!start) {
    return;
  }

  if (!targetCell) {
    const fallback = getCellNode(start.row, start.col) || state.selection.cells[0];
    applyPreview(fallback ? [fallback] : []);
    state.selection.path = [start];
    return;
  }

  const row = Number(targetCell.dataset.row);
  const col = Number(targetCell.dataset.col);

  const path = computeStraightPath(start, { row, col });

  if (!path) {
    const fallback = getCellNode(start.row, start.col) || state.selection.cells[0];
    applyPreview(fallback ? [fallback] : []);
    state.selection.path = [start];
    return;
  }

  state.selection.path = path;
  const cells = path.map((position) => getCellNode(position.row, position.col));
  applyPreview(cells);
}

function computeStraightPath(start, end) {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (absR === 0 && absC === 0) {
    return [start];
  }

  const validLine =
    (absR === 0 && absC > 0) ||
    (absC === 0 && absR > 0) ||
    absR === absC;

  if (!validLine) {
    return null;
  }

  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  const length = Math.max(absR, absC);
  const path = [];

  for (let index = 0; index <= length; index += 1) {
    path.push({
      row: start.row + stepR * index,
      col: start.col + stepC * index
    });
  }

  return path;
}

function applyPreview(cells) {
  clearPreview();
  if (!Array.isArray(cells) || cells.length === 0) {
    return;
  }
  const previewCells = cells.filter(Boolean);
  previewCells.forEach((cell) => {
    cell.classList.add("grid__cell--preview");
    cell.dataset.previewing = "true";
    if ((cell.dataset.status || "default") === "default") {
      cell.setAttribute("aria-selected", "true");
    }
  });
  state.selection.cells = previewCells;
}

function clearPreview() {
  state.selection.cells.forEach((cell) => {
    if (cell) {
      cell.classList.remove("grid__cell--preview");
      delete cell.dataset.previewing;
      if ((cell.dataset.status || "default") === "default") {
        cell.setAttribute("aria-selected", "false");
      }
    }
  });
  state.selection.cells = [];
}

function finalizeSelection() {
  clearTapSelection();
  const path = state.selection.path;
  clearSelectionListeners();
  if (!Array.isArray(path) || path.length === 0) {
    clearSelection();
    return;
  }

  const word = path.map((coords) => state.gridLetters[coords.row][coords.col]).join("");
  const candidate = state.wordLookup.get(word);

  if (candidate && !candidate.found) {
    markWordAsFound(candidate);
  } else if (!candidate && path.length > 1) {
    showSelectionError();
  }

  clearSelection();
}

function clearSelection() {
  releasePointerCapture();
  clearPreview();
  state.selection = {
    active: false,
    pointerId: null,
    pointerType: null,
    start: null,
    path: [],
    cells: [],
    captureTarget: null,
    dragged: false
  };
  clearSelectionListeners();
}

function clearSelectionListeners() {
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", handlePointerUp);
  window.removeEventListener("pointercancel", handlePointerCancel);
}

function releasePointerCapture() {
  const target = state.selection.captureTarget;
  const pointerId = state.selection.pointerId;
  if (!target || pointerId == null) {
    return;
  }
  if (typeof target.releasePointerCapture !== "function") {
    state.selection.captureTarget = null;
    return;
  }
  if (typeof target.hasPointerCapture === "function") {
    if (!target.hasPointerCapture(pointerId)) {
      state.selection.captureTarget = null;
      return;
    }
  }
  try {
    target.releasePointerCapture(pointerId);
  } catch (error) {
    // ignore release failures
  } finally {
    state.selection.captureTarget = null;
  }
}

function setTapSelection(position) {
  if (
    !position ||
    typeof position.row !== "number" ||
    typeof position.col !== "number"
  ) {
    clearTapSelection();
    return;
  }

  clearTapSelection();

  const cell = getCellNode(position.row, position.col);
  if (cell) {
    cell.classList.add("grid__cell--preview");
    cell.dataset.previewing = "true";
    if ((cell.dataset.status || "default") === "default") {
      cell.setAttribute("aria-selected", "true");
    }
  }

  state.tapSelection = {
    row: position.row,
    col: position.col,
    cell: cell || null
  };
}

function clearTapSelection() {
  if (!state.tapSelection) {
    return;
  }
  const { row, col, cell } = state.tapSelection;
  const targetCell = cell || getCellNode(row, col);
  if (targetCell) {
    targetCell.classList.remove("grid__cell--preview");
    delete targetCell.dataset.previewing;
    if ((targetCell.dataset.status || "default") === "default") {
      targetCell.setAttribute("aria-selected", "false");
    }
  }
  state.tapSelection = null;
}

function markWordAsFound(wordData) {
  wordData.found = true;
  if (wordData.entry) {
    wordData.entry.found = true;
    wordData.entry.solved = true;
  }
  state.foundCount += 1;

  if (
    state.lastPointerType === "touch" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    navigator.vibrate(30);
  }

  highlightPath(wordData.path, "grid__cell--found", "found");
  updateWordAccessibility(wordData, "found");

  if (wordData.listItem) {
    wordData.listItem.classList.remove("word-item--solved");
    wordData.listItem.classList.add("word-item--found");
    wordData.listItem.dataset.revealed = "true";
  }

  if (state.mode === "dica" && wordData.solutionEl) {
    wordData.solutionEl.hidden = false;
  }

  updateCounter();

  if (state.foundCount === state.wordData.length) {
    stopTimer();
    state.locked = true;
    toggleButtons(false);
    showScoreFeedback();
  }
}

function highlightPath(path, className, status) {
  path.forEach(({ row, col }) => {
    const cell = state.cellElements[row][col];
    if (cell) {
      cell.classList.remove("grid__cell--preview");
      delete cell.dataset.previewing;
      if (className === "grid__cell--found") {
        cell.classList.remove("grid__cell--solved");
      } else if (className === "grid__cell--solved") {
        cell.classList.remove("grid__cell--found");
      }
      cell.classList.add(className);
      if (status) {
        cell.dataset.status = status;
        cell.setAttribute("aria-selected", "true");
      }
    }
  });
}

function getStatusMessage(status) {
  switch (status) {
    case "found":
      return "Palavra encontrada";
    case "solved":
      return "Palavra revelada";
    default:
      return "Palavra ainda nao encontrada";
  }
}

function buildWordAria(entry, status) {
  if (state.mode === "dica") {
    if (status === "found") {
      return `Dica: ${entry.hint}. Palavra encontrada: ${entry.word}.`;
    }
    if (status === "solved") {
      return `Dica: ${entry.hint}. Palavra revelada: ${entry.word}.`;
    }
    return `Dica: ${entry.hint}. Palavra ainda nao encontrada.`;
  }

  if (status === "found") {
    return `Palavra: ${entry.word}. Palavra encontrada.`;
  }
  if (status === "solved") {
    return `Palavra: ${entry.word}. Palavra revelada.`;
  }
  return `Palavra: ${entry.word}. Ainda nao encontrada.`;
}

function updateWordAccessibility(placement, status) {
  if (!placement || !placement.entry) {
    return;
  }

  const entry = placement.entry;
  entry.status = status;

  if (placement.listItem) {
    placement.listItem.dataset.status = status;
    placement.listItem.setAttribute("aria-label", buildWordAria(entry, status));
  }

  if (placement.statusEl) {
    placement.statusEl.textContent = getStatusMessage(status);
  }
}

function updateCounter() {
  const label = state.l10n.found
    .replace("@found", String(state.foundCount))
    .replace("@totalWords", String(state.wordData.length));

  elements.counterLabel.textContent = label;
  elements.counterValue.textContent = "";
}

function resetTimer() {
  state.elapsedSeconds = 0;
  updateTimerUI();
}

function startTimer() {
  stopTimer();
  if (state.timerExpired) {
    return;
  }
  state.timerId = window.setInterval(() => {
    state.elapsedSeconds += 1;
    updateTimerUI();
    maybeHandleTimeLimit();
  }, 1000);
  maybeHandleTimeLimit();
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerUI() {
  elements.timerValue.textContent = formatTime(state.elapsedSeconds);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function maybeHandleTimeLimit() {
  if (!state.timeLimitSeconds || state.timerExpired) {
    return;
  }
  if (state.elapsedSeconds >= state.timeLimitSeconds) {
    handleTimeLimitReached();
  }
}

function handleTimeLimitReached() {
  if (state.timerExpired) {
    return;
  }

  state.timerExpired = true;
  state.elapsedSeconds = state.timeLimitSeconds;
  updateTimerUI();
  stopTimer();
  clearSelection();
  state.locked = true;
  if (elements.grid) {
    elements.grid.setAttribute("aria-disabled", "true");
  }
  toggleButtons(false);
  updateFeedback("Tempo esgotado. Clique em Reiniciar para tentar novamente.");
  openTimeLimitModal();
}

function handleCheck() {
  showScoreFeedback();
}

function showScoreFeedback() {
  const text = state.l10n.score
    .replace("@score", String(state.foundCount))
    .replace("@total", String(state.wordData.length));
  updateFeedback(text);
}

function handleShowSolution() {
  if (state.locked) {
    return;
  }
  stopTimer();
  clearTapSelection();
  state.locked = true;
  toggleButtons(false);

  state.wordData.forEach((wordData) => {
    if (!wordData.found) {
      highlightPath(wordData.path, "grid__cell--solved", "solved");
      if (wordData.listItem) {
        wordData.listItem.classList.add("word-item--solved");
      }
      updateWordAccessibility(wordData, "solved");
    } else {
      highlightPath(wordData.path, "grid__cell--found", "found");
      updateWordAccessibility(wordData, "found");
    }
    wordData.solved = true;
    if (wordData.entry) {
      wordData.entry.solved = true;
    }
    if (wordData.listItem) {
      wordData.listItem.dataset.revealed = "true";
    }
    if (state.mode === "dica" && wordData.solutionEl) {
      wordData.solutionEl.hidden = false;
    }
  });

  showScoreFeedback();
}

function openTimeLimitModal() {
  if (!elements.timeLimitModal) {
    return;
  }
  state.previousFocus =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;
  elements.timeLimitModal.hidden = false;
  const focusTarget = elements.timeLimitRetryBtn || elements.timeLimitCloseBtn;
  if (focusTarget && typeof focusTarget.focus === "function") {
    focusTarget.focus();
  }
}

function closeTimeLimitModal() {
  if (!elements.timeLimitModal) {
    return;
  }
  elements.timeLimitModal.hidden = true;
  const restartBtnVisible =
    elements.retryBtn &&
    !elements.retryBtn.hasAttribute("hidden") &&
    typeof elements.retryBtn.focus === "function";
  const target =
    state.timerExpired && restartBtnVisible
      ? elements.retryBtn
      : state.previousFocus;
  if (target && typeof target.focus === "function") {
    target.focus();
  }
  state.previousFocus = null;
}

function handleTimeLimitRetry() {
  startRound(shouldShowIntroOnRestart());
}

function handleTimeLimitClose() {
  closeTimeLimitModal();
}

function handleIntroStart() {
  closeInstructionPanel();
}

function handleRetry() {
  startRound(shouldShowIntroOnRestart());
}

function clearFeedbackTimer() {
  if (state.feedbackTimerId !== null && typeof window !== "undefined") {
    window.clearTimeout(state.feedbackTimerId);
  }
  state.feedbackTimerId = null;
}

function updateFeedback(message) {
  clearFeedbackTimer();
  state.feedbackMessage = message || "";
  if (!message) {
    elements.feedback.dataset.visible = "false";
    elements.feedback.textContent = "";
    return;
  }
  elements.feedback.dataset.visible = "true";
  elements.feedback.textContent = message;
}

function setTransientFeedback(message, duration = 1500) {
  updateFeedback(message);
  if (typeof window === "undefined") {
    return;
  }
  state.feedbackTimerId = window.setTimeout(() => {
    if (state.feedbackMessage === message) {
      updateFeedback("");
    }
  }, duration);
}

function showSelectionError() {
  const fallbackMessage = DEFAULT_L10N.invalidSelection;
  const message = state.l10n.invalidSelection || fallbackMessage;
  setTransientFeedback(message, 1600);
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function reverseString(value) {
  return value.split("").reverse().join("");
}

function shouldLoadVlibras() {
  const config = state.accessibility?.vlibras || { desktop: false, mobile: false };
  const mobile = isMobileDevice();
  return mobile ? Boolean(config.mobile) : Boolean(config.desktop);
}

function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );
}

function injectVlibrasWidget() {
  if (state.accessibility.vlibrasInjected || typeof document === "undefined") {
    return;
  }

  const root = document.createElement("div");
  root.setAttribute("vw", "");
  root.className = "enabled";

  const accessButton = document.createElement("div");
  accessButton.setAttribute("vw-access-button", "");
  accessButton.className = "active";
  accessButton.setAttribute("role", "button");
  accessButton.setAttribute("aria-label", "Ativar interpretacao em Libras");

  const pluginWrapper = document.createElement("div");
  pluginWrapper.setAttribute("vw-plugin-wrapper", "");
  const pluginTop = document.createElement("div");
  pluginTop.className = "vw-plugin-top-wrapper";
  pluginWrapper.appendChild(pluginTop);

  root.append(accessButton, pluginWrapper);
  document.body.appendChild(root);

  const initWidget = () => {
    if (window.VLibras && !state.accessibility.vlibrasWidget) {
      state.accessibility.vlibrasWidget = new window.VLibras.Widget(
        "https://vlibras.gov.br/app"
      );
    }
  };

  if (!state.accessibility.vlibrasScriptLoaded) {
    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.onload = () => {
      state.accessibility.vlibrasScriptLoaded = true;
      initWidget();
    };
    script.onerror = () => {
      console.warn("Nao foi possivel carregar o widget VLibras.");
    };
    document.body.appendChild(script);
  } else {
    initWidget();
  }

  state.accessibility.vlibrasInjected = true;
}

function getCellNode(row, col) {
  if (!state.cellElements[row]) {
    return null;
  }
  return state.cellElements[row][col] || null;
}
