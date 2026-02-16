import { canEndTurn } from "./game";
import { HighlightSet, InputState, SkillAvailability, SpiritSelectorView } from "./input";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COL_LABELS,
  Coord,
  GameState,
  PerspectiveCell,
  PerspectiveState,
  Side,
  SkillId,
  coordToKey,
  getSideLabel,
} from "./protocol";

interface Assets {
  ground: HTMLImageElement;
  grass: HTMLImageElement;
  spawn: HTMLImageElement;
  wall: HTMLImageElement;
  char: HTMLImageElement;
  numbers: Map<number, HTMLImageElement>;
}

interface SkillConfig {
  id: SkillId;
  label: string;
  basic: boolean;
}

interface BoardMetrics {
  left: number;
  top: number;
  tile: number;
  width: number;
  height: number;
}

interface AttackAnimation {
  actor: Side;
  from: Coord;
  to: Coord;
  startedAt: number;
  durationMs: number;
}

export interface ViewHandlers {
  onCellClick: (coord: Coord) => void;
  onSkillClick: (skill: SkillId) => void;
  onEndTurnClick: () => void;
  onSpiritAdjust: (delta: number) => void;
}

export interface RenderPayload {
  state: GameState;
  perspective: PerspectiveState;
  localSide: Side;
  connected: boolean;
  input: InputState;
  highlights: HighlightSet;
  skillAvailability: SkillAvailability;
  spiritSelector: SpiritSelectorView;
}

export interface GameView {
  setHandlers(handlers: ViewHandlers): void;
  render(payload: RenderPayload): void;
  playAttackAnimation(actor: Side, from: Coord, to: Coord): void;
}

const SKILLS: SkillConfig[] = [
  { id: "move", label: "\u79fb\u52d5", basic: true },
  { id: "build", label: "\u5efa\u9020", basic: true },
  { id: "scout", label: "\u5075\u5bdf", basic: true },
  { id: "attack", label: "\u666e\u653b", basic: true },
  { id: "role1", label: "", basic: false },
  { id: "role2", label: "", basic: false },
  { id: "role3", label: "", basic: false },
  { id: "role4", label: "", basic: false },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`load image failed: ${src}`));
  });
}

async function loadAssets(): Promise<Assets> {
  const [ground, grass, spawn, wall, char] = await Promise.all([
    loadImage("./assets/tiles/ground.png"),
    loadImage("./assets/tiles/grass.png"),
    loadImage("./assets/tiles/spawn.png"),
    loadImage("./assets/tiles/wall.png"),
    loadImage("./assets/char/reimu.png"),
  ]);

  const numbers = new Map<number, HTMLImageElement>();
  const tasks: Array<Promise<void>> = [];
  for (let value = 1; value <= 10; value += 1) {
    const file = value === 10 ? "no10.png" : `no${value}.png`;
    tasks.push(
      loadImage(`./assets/number/${file}`).then((image) => {
        numbers.set(value, image);
      }),
    );
  }
  await Promise.all(tasks);

  return { ground, grass, spawn, wall, char, numbers };
}

function getCell(cells: PerspectiveCell[], x: number, y: number): PerspectiveCell {
  return cells[y * BOARD_WIDTH + x];
}

function containsCoord(list: Coord[], target: Coord): boolean {
  return list.some((item) => item.x === target.x && item.y === target.y);
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function easeInQuad(t: number): number {
  return t * t;
}

export async function createGameView(root: HTMLElement): Promise<GameView> {
  const assets = await loadAssets();

  let handlers: ViewHandlers = {
    onCellClick: () => undefined,
    onSkillClick: () => undefined,
    onEndTurnClick: () => undefined,
    onSpiritAdjust: () => undefined,
  };
  let lastPayload: RenderPayload | null = null;
  let boardMetrics: BoardMetrics | null = null;
  let attackAnimation: AttackAnimation | null = null;
  let animationFrame = 0;

  const shell = document.createElement("div");
  shell.className = "game-shell";

  const frame = document.createElement("div");
  frame.className = "game-frame";
  shell.appendChild(frame);

  const boardPanel = document.createElement("section");
  boardPanel.className = "panel board-panel";
  frame.appendChild(boardPanel);

  const turnBar = document.createElement("div");
  turnBar.className = "turn-bar";
  boardPanel.appendChild(turnBar);

  const turnBlue = document.createElement("span");
  turnBlue.className = "turn-side turn-blue";
  turnBlue.textContent = "\u84dd\u65b9";
  turnBar.appendChild(turnBlue);

  const turnCenter = document.createElement("span");
  turnCenter.className = "turn-center";
  turnCenter.textContent = "\u7b2c1\u56de\u5408";
  turnBar.appendChild(turnCenter);

  const turnRed = document.createElement("span");
  turnRed.className = "turn-side turn-red";
  turnRed.textContent = "\u7ea2\u65b9";
  turnBar.appendChild(turnRed);

  const boardCanvasWrap = document.createElement("div");
  boardCanvasWrap.className = "board-canvas-wrap";
  boardPanel.appendChild(boardCanvasWrap);

  const boardCanvas = document.createElement("canvas");
  boardCanvas.className = "board-canvas";
  boardCanvasWrap.appendChild(boardCanvas);

  const announcementPanel = document.createElement("section");
  announcementPanel.className = "panel announcement-panel";
  frame.appendChild(announcementPanel);

  const announcementTitle = document.createElement("h3");
  announcementTitle.className = "panel-title";
  announcementTitle.textContent = "\u516c\u544a";
  announcementPanel.appendChild(announcementTitle);

  const announcementList = document.createElement("div");
  announcementList.className = "announcement-list";
  announcementPanel.appendChild(announcementList);

  const skillPanel = document.createElement("section");
  skillPanel.className = "panel skill-panel";
  frame.appendChild(skillPanel);

  const skillGrid = document.createElement("div");
  skillGrid.className = "skill-grid";
  skillPanel.appendChild(skillGrid);

  const skillButtons = new Map<SkillId, HTMLButtonElement>();
  for (const skill of SKILLS) {
    const button = document.createElement("button");
    button.className = `skill-btn ${skill.basic ? "skill-basic" : "skill-role"}`;
    button.textContent = skill.label;
    button.dataset.skill = skill.id;
    button.addEventListener("click", () => {
      handlers.onSkillClick(skill.id);
    });
    skillGrid.appendChild(button);
    skillButtons.set(skill.id, button);
  }

  const spiritPopup = document.createElement("div");
  spiritPopup.className = "spirit-popup";

  const spiritUp = document.createElement("button");
  spiritUp.className = "spirit-btn";
  spiritUp.textContent = "\u25b2";
  spiritUp.addEventListener("click", () => handlers.onSpiritAdjust(1));
  spiritPopup.appendChild(spiritUp);

  const spiritValue = document.createElement("div");
  spiritValue.className = "spirit-value";
  spiritPopup.appendChild(spiritValue);

  const spiritDown = document.createElement("button");
  spiritDown.className = "spirit-btn";
  spiritDown.textContent = "\u25bc";
  spiritDown.addEventListener("click", () => handlers.onSpiritAdjust(-1));
  spiritPopup.appendChild(spiritDown);

  skillPanel.appendChild(spiritPopup);

  const endTurnButton = document.createElement("button");
  endTurnButton.className = "end-turn-btn";
  endTurnButton.textContent = "\u7ed3\u675f\u56de\u5408";
  endTurnButton.addEventListener("click", () => {
    handlers.onEndTurnClick();
  });
  skillPanel.appendChild(endTurnButton);

  const statusPanel = document.createElement("section");
  statusPanel.className = "panel status-panel";
  frame.appendChild(statusPanel);

  const statusTitle = document.createElement("h3");
  statusTitle.className = "panel-title";
  statusTitle.textContent = "\u6570\u503c";
  statusPanel.appendChild(statusTitle);

  const statusList = document.createElement("div");
  statusList.className = "status-list";
  statusPanel.appendChild(statusList);

  const statusHp = document.createElement("div");
  const statusSpirit = document.createElement("div");
  const statusAtk = document.createElement("div");
  const statusCoord = document.createElement("div");
  const statusGold = document.createElement("div");
  statusList.append(statusHp, statusSpirit, statusAtk, statusCoord, statusGold);

  root.innerHTML = "";
  root.appendChild(shell);

  function updateCanvasSize(): void {
    const rect = boardCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    boardCanvas.width = Math.floor(rect.width * dpr);
    boardCanvas.height = Math.floor(rect.height * dpr);
  }

  function getAnimatedCoord(side: Side): { x: number; y: number } | null {
    if (!attackAnimation || attackAnimation.actor !== side) {
      return null;
    }
    const elapsed = performance.now() - attackAnimation.startedAt;
    const t = Math.max(0, Math.min(1, elapsed / attackAnimation.durationMs));
    if (t >= 1) {
      attackAnimation = null;
      return null;
    }

    if (t < 0.5) {
      const p = easeOutQuad(t * 2);
      return {
        x: attackAnimation.from.x + (attackAnimation.to.x - attackAnimation.from.x) * p,
        y: attackAnimation.from.y + (attackAnimation.to.y - attackAnimation.from.y) * p,
      };
    }

    const p = easeInQuad((t - 0.5) * 2);
    return {
      x: attackAnimation.to.x + (attackAnimation.from.x - attackAnimation.to.x) * p,
      y: attackAnimation.to.y + (attackAnimation.from.y - attackAnimation.to.y) * p,
    };
  }

  function drawBoard(payload: RenderPayload): void {
    updateCanvasSize();
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = boardCanvas.width / dpr;
    const h = boardCanvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const labelSpace = Math.max(20, Math.floor(Math.min(w, h) * 0.05));
    const tile = Math.max(
      12,
      Math.floor(Math.min((w - labelSpace * 2) / BOARD_WIDTH, (h - labelSpace * 2) / BOARD_HEIGHT)),
    );
    const boardW = tile * BOARD_WIDTH;
    const boardH = tile * BOARD_HEIGHT;
    const left = Math.floor((w - boardW - labelSpace) * 0.5 + labelSpace);
    const top = Math.floor((h - boardH - labelSpace) * 0.5 + labelSpace);

    boardMetrics = { left, top, tile, width: boardW, height: boardH };

    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(11, Math.floor(tile * 0.38))}px 'zpix', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      ctx.fillText(COL_LABELS[x], left + x * tile + tile * 0.5, top - Math.floor(labelSpace * 0.45));
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      ctx.fillText(String(y + 1), left - Math.floor(labelSpace * 0.45), top + y * tile + tile * 0.5);
    }

    const drawTerrain = (cell: PerspectiveCell, px: number, py: number): void => {
      let image = assets.ground;
      if (cell.terrain === "grass") {
        image = assets.grass;
      } else if (cell.terrain === "spawnBlue" || cell.terrain === "spawnRed") {
        image = assets.spawn;
      }
      ctx.drawImage(image, px, py, tile, tile);
      if (cell.hasWall) {
        ctx.drawImage(assets.wall, px, py, tile, tile);
      }
      if (!cell.visible) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(px, py, tile, tile);
      }
    };

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = getCell(payload.perspective.cells, x, y);
        const px = left + x * tile;
        const py = top + y * tile;
        drawTerrain(cell, px, py);

        if (containsCoord(payload.highlights.moveHighlights, cell.coord)) {
          ctx.fillStyle = "rgba(80, 160, 255, 0.35)";
          ctx.fillRect(px, py, tile, tile);
        }
        if (containsCoord(payload.highlights.attackHighlights, cell.coord)) {
          ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
          ctx.fillRect(px, py, tile, tile);
        }

        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
      }
    }

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = getCell(payload.perspective.cells, x, y);
        if (cell.wallHp === null || cell.wallHp <= 0) {
          continue;
        }
        const numTexture = assets.numbers.get(cell.wallHp);
        if (!numTexture) {
          continue;
        }
        const px = left + x * tile;
        const py = top + y * tile;
        const size = Math.floor(tile * 0.58);
        ctx.drawImage(
          numTexture,
          px + Math.floor((tile - size) * 0.5),
          py + Math.floor((tile - size) * 0.5),
          size,
          size,
        );
      }
    }

    const drawPiece = (side: Side): void => {
      const logicalPos = payload.perspective.pieces[side];
      if (!logicalPos) {
        return;
      }
      const animated = getAnimatedCoord(side);
      const drawPos = animated ?? logicalPos;

      const px = left + drawPos.x * tile;
      const py = top + drawPos.y * tile;
      const pad = Math.floor(tile * 0.08);
      ctx.drawImage(assets.char, px + pad, py + pad, tile - pad * 2, tile - pad * 2);
      ctx.strokeStyle = side === "blue" ? "#58a8ff" : "#ff6565";
      ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
      ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
    };

    drawPiece("blue");
    drawPiece("red");
  }

  function refreshSpiritPopup(payload: RenderPayload): void {
    const show = payload.spiritSelector.visible && payload.input.activeSkill === "build";
    if (!show) {
      spiritPopup.style.display = "none";
      return;
    }
    const anchor = skillButtons.get("build");
    if (!anchor) {
      spiritPopup.style.display = "none";
      return;
    }
    spiritPopup.style.display = "flex";
    spiritValue.textContent = String(payload.spiritSelector.value);
    spiritUp.disabled = payload.spiritSelector.value >= payload.spiritSelector.max;
    spiritDown.disabled = payload.spiritSelector.value <= payload.spiritSelector.min;

    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const popupWidth = 70;
    const popupHeight = 64;
    const left = anchorRect.left - panelRect.left + (anchorRect.width - popupWidth) * 0.5;
    const top = anchorRect.top - panelRect.top - popupHeight - 6;
    spiritPopup.style.left = `${Math.max(0, left)}px`;
    spiritPopup.style.top = `${Math.max(0, top)}px`;
  }

  boardCanvas.addEventListener("click", (event) => {
    if (!boardMetrics) {
      return;
    }
    const rect = boardCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const inside =
      x >= boardMetrics.left &&
      x < boardMetrics.left + boardMetrics.width &&
      y >= boardMetrics.top &&
      y < boardMetrics.top + boardMetrics.height;
    if (!inside) {
      return;
    }
    handlers.onCellClick({
      x: Math.floor((x - boardMetrics.left) / boardMetrics.tile),
      y: Math.floor((y - boardMetrics.top) / boardMetrics.tile),
    });
  });

  function renderSkillState(payload: RenderPayload): void {
    const availability = payload.skillAvailability;

    for (const skill of SKILLS) {
      const button = skillButtons.get(skill.id);
      if (!button) {
        continue;
      }

      let usable = false;
      if (skill.id === "move") {
        usable = availability.move;
      } else if (skill.id === "build") {
        usable = availability.build;
      } else if (skill.id === "scout") {
        usable = availability.scout;
      } else if (skill.id === "attack") {
        usable = availability.attack;
      }

      button.classList.toggle("skill-usable", usable);
      button.classList.toggle("skill-disabled", !usable);
      button.classList.toggle("skill-selected", payload.input.activeSkill === skill.id);
      button.classList.toggle("skill-quickcast", payload.input.quickCast && skill.id === "move");
      button.disabled = !usable || !skill.basic;
    }

    endTurnButton.disabled = !payload.connected || !canEndTurn(payload.state, payload.localSide);
    refreshSpiritPopup(payload);
  }

  function renderTurn(payload: RenderPayload): void {
    if (payload.state.winner) {
      turnBlue.classList.remove("turn-active");
      turnRed.classList.remove("turn-active");
      turnCenter.textContent = `${getSideLabel(payload.state.winner)}\u83b7\u80dc`;
      return;
    }
    const current = payload.state.turn.side;
    turnBlue.classList.toggle("turn-active", current === "blue");
    turnRed.classList.toggle("turn-active", current === "red");
    turnCenter.textContent =
      `\u7b2c${payload.state.turn.round}\u56de\u5408 | ` +
      `\u5f53\u524d: ${getSideLabel(current)}`;
  }

  function renderStatus(payload: RenderPayload): void {
    const unit = payload.state.players[payload.localSide];
    statusHp.textContent = `\u751f\u547d\u503c: ${unit.stats.hp}`;
    statusSpirit.textContent =
      `\u5f53\u524d\u7075\u529b/\u7075\u529b\u4e0a\u9650: ${unit.stats.spirit}/${unit.stats.maxSpirit}`;
    statusAtk.textContent = `\u653b\u51fb\u529b: ${unit.stats.atk}`;
    statusCoord.textContent = `\u5750\u6807: ${coordToKey(unit.pos)}`;
    statusGold.textContent = `\u91d1\u5e01: ${unit.stats.gold}`;
  }

  function renderAnnouncement(payload: RenderPayload): void {
    announcementList.innerHTML = "";
    if (payload.state.announcements.length === 0) {
      const empty = document.createElement("div");
      empty.className = "announcement-item";
      empty.textContent = "\u6682\u65e0\u516c\u544a";
      announcementList.appendChild(empty);
      return;
    }
    const history = [...payload.state.announcements].reverse();
    for (const entry of history) {
      const item = document.createElement("div");
      item.className = "announcement-item";
      item.textContent = entry;
      announcementList.appendChild(item);
    }
  }

  function render(payload: RenderPayload): void {
    lastPayload = payload;
    drawBoard(payload);
    renderSkillState(payload);
    renderTurn(payload);
    renderStatus(payload);
    renderAnnouncement(payload);
  }

  function tickAnimation(): void {
    animationFrame = 0;
    if (!lastPayload) {
      return;
    }
    render(lastPayload);
    if (attackAnimation) {
      animationFrame = window.requestAnimationFrame(tickAnimation);
    }
  }

  function ensureAnimationLoop(): void {
    if (animationFrame !== 0) {
      return;
    }
    animationFrame = window.requestAnimationFrame(tickAnimation);
  }

  window.addEventListener("resize", () => {
    if (lastPayload) {
      render(lastPayload);
    }
  });

  return {
    setHandlers(nextHandlers: ViewHandlers): void {
      handlers = nextHandlers;
    },
    render,
    playAttackAnimation(actor: Side, from: Coord, to: Coord): void {
      attackAnimation = {
        actor,
        from: { ...from },
        to: { ...to },
        startedAt: performance.now(),
        durationMs: 280,
      };
      ensureAnimationLoop();
    },
  };
}
