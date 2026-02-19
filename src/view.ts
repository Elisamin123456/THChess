import { canEndTurn } from "./game";
import { HighlightSet, InputState, SkillAvailability, SpiritSelectorView } from "./input";
import { BpState, getBanAgainst, getBpPhaseLabel, getBpTurn, isBpOptionEnabled } from "./bp";
import {
  BP_OPTIONS,
  getMechDefinition,
  getMechName,
  getRoleSkillDefinition,
  isRoleSkillImplemented,
} from "./mech";
import {
  BpBanOptionId,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COL_LABELS,
  Coord,
  GameState,
  MechId,
  PerspectiveCell,
  PerspectiveState,
  ProjectileEffect,
  RoleSkillId,
  Side,
  SkillId,
  UnitState,
  coordToDisplayKey,
  coordToKey,
  getSideLabel,
  isRoleSkillId,
  keyToCoord,
} from "./protocol";

interface Assets {
  ground: HTMLImageElement;
  grass: HTMLImageElement;
  spawn: HTMLImageElement;
  wall: HTMLImageElement;
  markers: [HTMLImageElement, HTMLImageElement, HTMLImageElement, HTMLImageElement];
  chars: Record<MechId, HTMLImageElement>;
  needle: HTMLImageElement;
  amulet: HTMLImageElement;
  wind: HTMLImageElement;
  sigil: HTMLImageElement;
  orbEffect: HTMLImageElement;
  koishiHeart: HTMLImageElement;
  roleIconsByMech: Record<MechId, Partial<Record<RoleSkillId, SkillIconSet>>>;
  numbers: Map<number, HTMLImageElement>;
  numberSrc: Map<number, string>;
}

interface SkillIconSet {
  normal: HTMLImageElement;
  selected: HTMLImageElement;
  selecting: HTMLImageElement;
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

interface ProjectileAnimation {
  id: number;
  batchId: number;
  kind: "needle" | "amulet" | "wind";
  actor: Side;
  start: Coord;
  end: Coord;
  startedAt: number;
  delayMs: number;
  durationMs: number;
  done: boolean;
}

interface ProjectileBatchState {
  pending: number;
  resolve: () => void;
}

interface BpCardLayout {
  id: BpBanOptionId;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TooltipContent {
  title: string;
  body: string;
}

export interface ViewHandlers {
  onCellClick: (coord: Coord) => void;
  onSkillClick: (skill: SkillId) => void;
  onUnlockSkill: (skill: RoleSkillId) => void;
  onEndTurnClick: () => void;
  onSpiritAdjust: (delta: number) => void;
  onBpOptionClick: (optionId: BpBanOptionId) => void;
  onBpConfirm: () => void;
}

export interface RenderPayload {
  state: GameState;
  perspective: PerspectiveState;
  localSide: Side;
  connected: boolean;
  ballisticPending: boolean;
  input: InputState;
  highlights: HighlightSet;
  skillAvailability: SkillAvailability;
  spiritSelector: SpiritSelectorView;
}

export interface BpRenderPayload {
  bp: BpState;
  localSide: Side;
  connected: boolean;
  selectedOption: BpBanOptionId | null;
}

export interface GameView {
  setHandlers(handlers: ViewHandlers): void;
  render(payload: RenderPayload): void;
  renderBp(payload: BpRenderPayload): void;
  playAttackAnimation(actor: Side, from: Coord, to: Coord): void;
  playProjectileAnimations(projectiles: ProjectileEffect[]): Promise<void>;
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

// 所有技能介绍文本不可更改。
const BASIC_SKILL_TOOLTIPS: Record<"move" | "build" | "scout" | "attack", TooltipContent> = {
  move: {
    title: "移动",
    body: "向8向移动，正方向移动后增加1灵力，斜向移动不增加灵力。",
  },
  build: {
    title: "建造",
    body: "消费N灵力，在距离为N的范围内建造生命值上限为N的墙体。墙体无法建造在任意单位之上。",
  },
  scout: {
    title: "侦察",
    body: "消费1灵力，立刻获得对方坐标。",
  },
  attack: {
    title: "普通攻击",
    body: "进行一次距离为1的攻击造成等同于击力的伤害。",
  },
};

const ROLE_SLOT_LABELS: Record<RoleSkillId, string> = {
  role1: "技能1",
  role2: "技能2",
  role3: "技能3",
  role4: "技能4",
};

const VARIABLE_SPIRIT_SKILLS = new Set<SkillId>(["build", "role1", "role3", "role4"]);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`load image failed: ${src}`));
  });
}

async function loadRoleIconSet(baseDir: string, prefix: string): Promise<SkillIconSet> {
  const [normal, selected, selecting] = await Promise.all([
    loadImage(`${baseDir}/${prefix}.png`),
    loadImage(`${baseDir}/${prefix}_selected.png`),
    loadImage(`${baseDir}/${prefix}_selecting.png`),
  ]);
  return { normal, selected, selecting };
}

async function loadSingleRoleIcon(src: string): Promise<SkillIconSet> {
  const icon = await loadImage(src);
  return {
    normal: icon,
    selected: icon,
    selecting: icon,
  };
}

async function loadAssets(): Promise<Assets> {
  const [
    ground,
    grass,
    spawn,
    wall,
    reimu,
    marisa,
    koishi,
    aya,
    needle,
    amulet,
    wind,
    sigil,
    orbEffect,
    koishiHeart,
    reimuRole1,
    reimuRole2,
    reimuRole3,
    reimuRole4,
    koishiRole1,
    koishiRole2,
    koishiRole3,
    koishiRole4,
    ayaRole1,
    ayaRole2,
    ayaRole3,
    ayaRole4,
    marker1,
    marker2,
    marker3,
    marker4,
  ] =
    await Promise.all([
      loadImage("./assets/tiles/ground.png"),
      loadImage("./assets/tiles/grass.png"),
      loadImage("./assets/tiles/spawn.png"),
      loadImage("./assets/tiles/wall.png"),
      loadImage("./assets/char/reimu.png"),
      loadImage("./assets/char/marisa.png"),
      loadImage("./assets/char/koishi.png"),
      loadImage("./assets/char/aya.png"),
      loadImage("./assets/bullet/reimu/reimuneedle.png"),
      loadImage("./assets/bullet/reimu/reimuamulet.png"),
      loadImage("./assets/bullet/aya/wind.png"),
      loadImage("./assets/bullet/aya/sigil.png"),
      loadImage("./assets/bullet/reimu/yinyangorb.png"),
      loadImage("./assets/bullet/koishi/heart.png"),
      loadRoleIconSet("./assets/skill/reimu", "reimu_1"),
      loadRoleIconSet("./assets/skill/reimu", "reimu_2"),
      loadRoleIconSet("./assets/skill/reimu", "reimu_3"),
      loadRoleIconSet("./assets/skill/reimu", "reimu_4"),
      loadSingleRoleIcon("./assets/skill/koishi/koishi1.png"),
      loadSingleRoleIcon("./assets/skill/koishi/koishi2.png"),
      loadSingleRoleIcon("./assets/skill/koishi/koishi3.png"),
      loadSingleRoleIcon("./assets/skill/koishi/koishi4.png"),
      loadSingleRoleIcon("./assets/skill/aya/aya1.png"),
      loadSingleRoleIcon("./assets/skill/aya/aya2.png"),
      loadSingleRoleIcon("./assets/skill/aya/aya3.png"),
      loadSingleRoleIcon("./assets/skill/aya/aya4.png"),
      loadImage("./assets/markers/mark1.png"),
      loadImage("./assets/markers/mark2.png"),
      loadImage("./assets/markers/mark3.png"),
      loadImage("./assets/markers/mark4.png"),
    ]);

  const numbers = new Map<number, HTMLImageElement>();
  const numberSrc = new Map<number, string>();
  const tasks: Array<Promise<void>> = [];
  for (let value = 0; value <= 10; value += 1) {
    const file = value === 0 ? "no.png" : value === 10 ? "no10.png" : `no${value}.png`;
    const src = `./assets/number/${file}`;
    numberSrc.set(value, src);
    tasks.push(
      loadImage(src).then((image) => {
        numbers.set(value, image);
      }),
    );
  }
  await Promise.all(tasks);

  return {
    ground,
    grass,
    spawn,
    wall,
    markers: [marker1, marker2, marker3, marker4],
    chars: {
      reimu,
      marisa,
      koishi,
      aya,
    },
    needle,
    amulet,
    wind,
    sigil,
    orbEffect,
    koishiHeart,
    roleIconsByMech: {
      reimu: {
        role1: reimuRole1,
        role2: reimuRole2,
        role3: reimuRole3,
        role4: reimuRole4,
      },
      marisa: {},
      koishi: {
        role1: koishiRole1,
        role2: koishiRole2,
        role3: koishiRole3,
        role4: koishiRole4,
      },
      aya: {
        role1: ayaRole1,
        role2: ayaRole2,
        role3: ayaRole3,
        role4: ayaRole4,
      },
    },
    numbers,
    numberSrc,
  };
}

function getCell(cells: PerspectiveCell[], x: number, y: number): PerspectiveCell {
  return cells[y * BOARD_WIDTH + x];
}

function coordsOrNullEqual(a: Coord | null, b: Coord | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.x === b.x && a.y === b.y;
}

function buildRayEdgePoint(origin: Coord, target: Coord): { x: number; y: number } | null {
  const startX = origin.x + 0.5;
  const startY = origin.y + 0.5;
  const dx = target.x + 0.5 - startX;
  const dy = target.y + 0.5 - startY;
  if (dx === 0 && dy === 0) {
    return null;
  }

  let tMin = Number.POSITIVE_INFINITY;
  if (dx > 0) {
    tMin = Math.min(tMin, (BOARD_WIDTH - startX) / dx);
  } else if (dx < 0) {
    tMin = Math.min(tMin, (0 - startX) / dx);
  }
  if (dy > 0) {
    tMin = Math.min(tMin, (BOARD_HEIGHT - startY) / dy);
  } else if (dy < 0) {
    tMin = Math.min(tMin, (0 - startY) / dy);
  }

  if (!Number.isFinite(tMin) || tMin <= 0) {
    return null;
  }
  return {
    x: startX + dx * tMin,
    y: startY + dy * tMin,
  };
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function easeInQuad(t: number): number {
  return t * t;
}

function getDisplayNumberTexture(assets: Assets, value: number, allowZero = false): HTMLImageElement | null {
  if (value < 0 || (!allowZero && value === 0)) {
    return null;
  }
  const clamped = allowZero ? Math.max(0, Math.min(10, Math.floor(value))) : Math.min(10, Math.floor(value));
  return assets.numbers.get(clamped) ?? null;
}

function getDisplayNumberSrc(assets: Assets, value: number, allowZero = false): string | null {
  if (value < 0 || (!allowZero && value === 0)) {
    return null;
  }
  const clamped = allowZero ? Math.max(0, Math.min(10, Math.floor(value))) : Math.min(10, Math.floor(value));
  return assets.numberSrc.get(clamped) ?? null;
}

function isVariableSkill(skill: SkillId | null): boolean {
  return Boolean(skill && VARIABLE_SPIRIT_SKILLS.has(skill));
}

function isRayIndicatorSkill(skill: SkillId | null, mechId: MechId | null): boolean {
  if (skill === "role1" || skill === "role4") {
    return mechId !== "koishi";
  }
  if (skill === "role2") {
    return mechId !== "aya" && mechId !== "koishi";
  }
  return false;
}

function getUnitDisplayBadges(unit: UnitState): Array<{ value: number; allowZero?: boolean }> {
  if (unit.mechId === "koishi") {
    return [
      ...(unit.effects.koishiStealthTurns > 0 ? [{ value: unit.effects.koishiStealthTurns }] : []),
      ...(unit.effects.koishiPolygraphTurns > 0 ? [{ value: unit.effects.koishiPolygraphTurns }] : []),
      ...(unit.effects.koishiPhilosophyActive ? [{ value: 1 }] : []),
    ];
  }
  if (unit.mechId === "aya") {
    const stealthTurns =
      unit.effects.ayaStealthTurns > 0 ? unit.effects.ayaStealthTurns : unit.effects.ayaStealthReady ? 2 : 0;
    return stealthTurns > 0 ? [{ value: stealthTurns }] : [];
  }
  if (unit.effects.orbTurns > 0) {
    return [{ value: unit.effects.orbTurns }];
  }
  return [];
}

function getKoishiAuraTiles(center: Coord): Coord[] {
  const result: Coord[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const x = center.x + dx;
      const y = center.y + dy;
      if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
        continue;
      }
      result.push({ x, y });
    }
  }
  return result;
}

function hasPerspectivePiece(perspective: PerspectiveState, side: Side): boolean {
  return Boolean(perspective.pieces[side]);
}

function drawBadgeStrip(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  px: number,
  py: number,
  tile: number,
  badges: Array<{ value: number; allowZero?: boolean }>,
): void {
  if (badges.length === 0) {
    return;
  }
  const badgeSize = Math.floor(tile * 0.34);
  const gap = 2;
  for (let index = 0; index < badges.length; index += 1) {
    const badge = badges[index];
    const texture = getDisplayNumberTexture(assets, badge.value, Boolean(badge.allowZero));
    if (!texture) {
      continue;
    }
    const drawX = px + tile - badgeSize - 2 - index * (badgeSize + gap);
    const drawY = py + 2;
    ctx.drawImage(texture, drawX, drawY, badgeSize, badgeSize);
  }
}

function shouldDrawKoishiAura(payload: RenderPayload, side: Side): boolean {
  const unit = payload.state.players[side];
  if (unit.mechId !== "koishi" || !unit.effects.koishiHeartAuraActive) {
    return false;
  }
  if (side === payload.localSide) {
    return true;
  }
  return hasPerspectivePiece(payload.perspective, side);
}

export async function createGameView(root: HTMLElement): Promise<GameView> {
  const assets = await loadAssets();

  let handlers: ViewHandlers = {
    onCellClick: () => undefined,
    onSkillClick: () => undefined,
    onUnlockSkill: () => undefined,
    onEndTurnClick: () => undefined,
    onSpiritAdjust: () => undefined,
    onBpOptionClick: () => undefined,
    onBpConfirm: () => undefined,
  };
  let lastPayload: RenderPayload | null = null;
  let lastBpPayload: BpRenderPayload | null = null;
  let currentMode: "battle" | "bp" = "battle";
  let boardMetrics: BoardMetrics | null = null;
  const bpCardLayouts: BpCardLayout[] = [];
  let attackAnimation: AttackAnimation | null = null;
  let animationFrame = 0;
  let hoverCoord: Coord | null = null;
  let hoverBpOption: BpBanOptionId | null = null;
  let selectedMarkerIndex = 0;
  const localMarkers = new Map<string, number>();

  let projectileId = 0;
  let projectileBatchId = 0;
  const projectileAnimations: ProjectileAnimation[] = [];
  const projectileBatchStates = new Map<number, ProjectileBatchState>();

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

  const skillLayout = document.createElement("div");
  skillLayout.className = "skill-layout";
  skillPanel.appendChild(skillLayout);

  const battleSkillSection = document.createElement("div");
  battleSkillSection.className = "battle-skill-section";
  skillLayout.appendChild(battleSkillSection);

  const basicSkillGrid = document.createElement("div");
  basicSkillGrid.className = "basic-skill-grid";
  battleSkillSection.appendChild(basicSkillGrid);

  const roleActionColumn = document.createElement("div");
  roleActionColumn.className = "role-action-column";
  battleSkillSection.appendChild(roleActionColumn);

  const roleSkillGrid = document.createElement("div");
  roleSkillGrid.className = "role-skill-grid";
  roleActionColumn.appendChild(roleSkillGrid);

  const skillActions = document.createElement("div");
  skillActions.className = "skill-actions";
  roleActionColumn.appendChild(skillActions);

  const markSkillGrid = document.createElement("div");
  markSkillGrid.className = "mark-skill-grid";
  battleSkillSection.appendChild(markSkillGrid);

  const bpSkillSection = document.createElement("div");
  bpSkillSection.className = "bp-skill-section";
  bpSkillSection.style.display = "none";
  skillLayout.appendChild(bpSkillSection);

  const bpSkillTitle = document.createElement("div");
  bpSkillTitle.className = "bp-skill-title";
  bpSkillTitle.textContent = "Mech Skills";
  bpSkillSection.appendChild(bpSkillTitle);

  const bpSkillGrid = document.createElement("div");
  bpSkillGrid.className = "bp-skill-grid";
  bpSkillSection.appendChild(bpSkillGrid);

  const bpSkillActions = document.createElement("div");
  bpSkillActions.className = "bp-skill-actions";
  bpSkillSection.appendChild(bpSkillActions);

  const bpConfirmButton = document.createElement("button");
  bpConfirmButton.className = "end-turn-btn hollow-frame";
  bpConfirmButton.textContent = "BP Confirm";
  bpConfirmButton.addEventListener("click", () => {
    handlers.onBpConfirm();
  });
  bpSkillActions.appendChild(bpConfirmButton);

  const bpSkillItems = new Map<RoleSkillId, HTMLDivElement>();
  for (const roleSkillId of ["role1", "role2", "role3", "role4"] as RoleSkillId[]) {
    const item = document.createElement("div");
    item.className = "bp-skill-item hollow-frame";
    item.addEventListener("mouseenter", () => {
      showTooltip(roleSkillId, item);
    });
    item.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    bpSkillGrid.appendChild(item);
    bpSkillItems.set(roleSkillId, item);
  }

  const skillButtons = new Map<SkillId, HTMLButtonElement>();
  const roleDurationBadges = new Map<RoleSkillId, HTMLImageElement>();

  const tooltip = document.createElement("div");
  tooltip.className = "skill-tooltip";
  tooltip.style.display = "none";
  const tooltipTitle = document.createElement("div");
  tooltipTitle.className = "skill-tooltip-title";
  const tooltipBody = document.createElement("div");
  tooltipBody.className = "skill-tooltip-body";
  tooltip.append(tooltipTitle, tooltipBody);
  skillPanel.appendChild(tooltip);

  const unlockPopup = document.createElement("div");
  unlockPopup.className = "unlock-popup";
  unlockPopup.style.display = "none";

  const unlockText = document.createElement("div");
  unlockText.className = "unlock-text";
  unlockText.textContent = "\u4f7f\u7528100\u91d1\u5e01\u89e3\u9501\u6280\u80fd\uff1f";
  unlockPopup.appendChild(unlockText);

  const unlockActions = document.createElement("div");
  unlockActions.className = "unlock-actions";
  const unlockYes = document.createElement("button");
  unlockYes.className = "unlock-btn";
  unlockYes.textContent = "\u89e3\u9501";
  const unlockNo = document.createElement("button");
  unlockNo.className = "unlock-btn";
  unlockNo.textContent = "\u53d6\u6d88";
  unlockActions.append(unlockYes, unlockNo);
  unlockPopup.appendChild(unlockActions);
  skillPanel.appendChild(unlockPopup);

  let unlockPendingSkill: RoleSkillId | null = null;

  function hideUnlockPopup(): void {
    unlockPopup.style.display = "none";
    unlockPendingSkill = null;
  }

  function hideTooltip(): void {
    tooltip.style.display = "none";
  }

  function resolvePreviewMechForSkillPanel(): MechId | null {
    if (currentMode === "bp") {
      if (!lastBpPayload || !lastBpPayload.selectedOption || lastBpPayload.selectedOption === "none") {
        return null;
      }
      return lastBpPayload.selectedOption;
    }
    if (!lastPayload) {
      return null;
    }
    return lastPayload.state.players[lastPayload.localSide].mechId;
  }

  function getTooltipContent(skill: SkillId): TooltipContent {
    if (skill === "move" || skill === "build" || skill === "scout" || skill === "attack") {
      return BASIC_SKILL_TOOLTIPS[skill];
    }
    const mechId = resolvePreviewMechForSkillPanel();
    if (!mechId) {
      return {
        title: "技能说明",
        body: "请先在BP界面选择机体。",
      };
    }
    const roleSkill = getRoleSkillDefinition(mechId, skill);
    if (!roleSkill.implemented) {
      return {
        title: roleSkill.name || ROLE_SLOT_LABELS[skill],
        body: "该机体暂无此技能说明。",
      };
    }
    return {
      title: roleSkill.name || ROLE_SLOT_LABELS[skill],
      body: roleSkill.description,
    };
  }

  function showTooltip(skill: SkillId, anchor: HTMLElement): void {
    const content = getTooltipContent(skill);
    if (!content.title && !content.body) {
      return;
    }
    tooltipTitle.textContent = content.title;
    tooltipBody.textContent = content.body;
    tooltip.style.display = "block";

    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const leftRaw = anchorRect.left - panelRect.left + (anchorRect.width - tooltipWidth) * 0.5;
    const maxLeft = Math.max(0, panelRect.width - tooltipWidth);
    const left = Math.min(maxLeft, Math.max(0, leftRaw));

    let top = anchorRect.top - panelRect.top - tooltipHeight - 6;
    if (top < 0) {
      top = anchorRect.bottom - panelRect.top + 6;
    }
    const maxTop = Math.max(0, panelRect.height - tooltipHeight);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.min(maxTop, Math.max(0, top))}px`;
  }

  function showUnlockPopup(skill: RoleSkillId, anchor: HTMLElement): void {
    if (!lastPayload) {
      return;
    }
    const unit = lastPayload.state.players[lastPayload.localSide];
    const canUnlock =
      !lastPayload.state.winner &&
      lastPayload.connected &&
      lastPayload.state.turn.side === lastPayload.localSide &&
      !lastPayload.state.turn.acted &&
      lastPayload.state.turn.pendingAction === null &&
      isRoleSkillImplemented(unit.mechId, skill) &&
      !unit.skills[skill] &&
      unit.stats.gold >= 100;

    unlockPendingSkill = skill;
    unlockText.textContent = canUnlock
      ? "\u4f7f\u7528100\u91d1\u5e01\u89e3\u9501\u8be5\u6280\u80fd\uff1f"
      : "\u91d1\u5e01\u4e0d\u8db3\u6216\u5f53\u524d\u4e0d\u53ef\u89e3\u9501";
    unlockYes.disabled = !canUnlock;

    const panelRect = skillPanel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const popupWidth = 182;
    const popupHeight = 82;
    const left = anchorRect.left - panelRect.left + (anchorRect.width - popupWidth) * 0.5;
    const top = anchorRect.top - panelRect.top - popupHeight - 6;

    unlockPopup.style.display = "block";
    unlockPopup.style.left = `${Math.max(0, left)}px`;
    unlockPopup.style.top = `${Math.max(0, top)}px`;
  }

  unlockYes.addEventListener("click", () => {
    if (!unlockPendingSkill) {
      return;
    }
    const skill = unlockPendingSkill;
    hideUnlockPopup();
    handlers.onUnlockSkill(skill);
  });

  unlockNo.addEventListener("click", () => {
    hideUnlockPopup();
  });

  for (const skill of SKILLS) {
    const button = document.createElement("button");
    button.className = `skill-btn hollow-frame ${skill.basic ? "skill-basic" : "skill-role"}`;
    button.textContent = skill.label;
    button.dataset.skill = skill.id;

    if (!skill.basic && isRoleSkillId(skill.id)) {
      const badge = document.createElement("img");
      badge.className = "skill-duration";
      badge.alt = "duration";
      badge.draggable = false;
      badge.style.display = "none";
      button.appendChild(badge);
      roleDurationBadges.set(skill.id, badge);
    }

    button.addEventListener("mouseenter", () => {
      showTooltip(skill.id, button);
    });
    button.addEventListener("mouseleave", () => {
      hideTooltip();
    });

    button.addEventListener("click", () => {
      if (currentMode !== "battle") {
        return;
      }
      if (!lastPayload) {
        return;
      }
      hideTooltip();

      if (isRoleSkillId(skill.id)) {
        const unit = lastPayload.state.players[lastPayload.localSide];
        if (!unit.skills[skill.id]) {
          showUnlockPopup(skill.id, button);
          return;
        }
      }

      hideUnlockPopup();
      handlers.onSkillClick(skill.id);
    });

    if (skill.basic) {
      basicSkillGrid.appendChild(button);
    } else {
      roleSkillGrid.appendChild(button);
    }
    skillButtons.set(skill.id, button);
  }

  const markButtons: HTMLButtonElement[] = [];

  function refreshMarkerSelection(): void {
    markButtons.forEach((button, index) => {
      button.classList.toggle("mark-selected", index === selectedMarkerIndex);
    });
  }

  for (let index = 0; index < assets.markers.length; index += 1) {
    const button = document.createElement("button");
    button.className = "mark-btn hollow-frame";
    const icon = document.createElement("img");
    icon.className = "mark-btn-icon";
    icon.src = assets.markers[index].src;
    icon.alt = `mark-${index + 1}`;
    icon.draggable = false;
    button.appendChild(icon);
    button.addEventListener("click", () => {
      selectedMarkerIndex = index;
      refreshMarkerSelection();
    });
    markSkillGrid.appendChild(button);
    markButtons.push(button);
  }
  refreshMarkerSelection();

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
  endTurnButton.className = "end-turn-btn hollow-frame";
  endTurnButton.textContent = "\u7a7a\u8fc7";
  endTurnButton.addEventListener("click", () => {
    if (currentMode === "bp") {
      handlers.onBpConfirm();
      return;
    }
    handlers.onEndTurnClick();
  });
  skillActions.appendChild(endTurnButton);

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

  function updateCanvasSize(): { dpr: number; width: number; height: number } {
    const rect = boardCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    boardCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    boardCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    return {
      dpr,
      width: boardCanvas.width / dpr,
      height: boardCanvas.height / dpr,
    };
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

  function getProjectileRenderState(
    animation: ProjectileAnimation,
    now: number,
  ): { pos: { x: number; y: number }; angle: number } | null {
    const elapsed = now - animation.startedAt - animation.delayMs;
    if (elapsed < 0) {
      return null;
    }

    const dx = animation.end.x - animation.start.x;
    const dy = animation.end.y - animation.start.y;
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
      return null;
    }

    const t = Math.max(0, Math.min(1, elapsed / animation.durationMs));
    if (t >= 1) {
      return null;
    }

    return {
      pos: {
        x: animation.start.x + dx * t,
        y: animation.start.y + dy * t,
      },
      angle: Math.atan2(dy, dx) + Math.PI / 2,
    };
  }

  function completeProjectile(animation: ProjectileAnimation): void {
    if (animation.done) {
      return;
    }
    animation.done = true;
    const batch = projectileBatchStates.get(animation.batchId);
    if (!batch) {
      return;
    }
    batch.pending -= 1;
    if (batch.pending <= 0) {
      projectileBatchStates.delete(animation.batchId);
      batch.resolve();
    }
  }

  function drawBoard(payload: RenderPayload): void {
    const canvasSize = updateCanvasSize();
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { dpr, width: w, height: h } = canvasSize;

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
    const moveHighlightKeys = new Set(payload.highlights.moveHighlights.map((coord) => coordToKey(coord)));
    const attackHighlightKeys = new Set(payload.highlights.attackHighlights.map((coord) => coordToKey(coord)));

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

        if (moveHighlightKeys.has(coordToKey(cell.coord))) {
          ctx.fillStyle = "rgba(80, 160, 255, 0.35)";
          ctx.fillRect(px, py, tile, tile);
        }
        if (attackHighlightKeys.has(coordToKey(cell.coord))) {
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
        const numTexture = getDisplayNumberTexture(assets, cell.wallHp);
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

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const cell = getCell(payload.perspective.cells, x, y);
        if (!cell.visible || !cell.hasWall) {
          continue;
        }
        const wallState = payload.state.walls[coordToKey(cell.coord)];
        if (!wallState?.alive || !wallState.ayaSigil) {
          continue;
        }
        const px = left + x * tile;
        const py = top + y * tile;
        const size = Math.floor(tile * 0.56);
        ctx.drawImage(
          assets.sigil,
          px + Math.floor((tile - size) * 0.5),
          py + Math.floor((tile - size) * 0.5),
          size,
          size,
        );
      }
    }

    for (const side of ["blue", "red"] as Side[]) {
      if (!shouldDrawKoishiAura(payload, side)) {
        continue;
      }
      const koishi = payload.state.players[side];
      for (const coord of getKoishiAuraTiles(koishi.pos)) {
        const cell = getCell(payload.perspective.cells, coord.x, coord.y);
        if (!cell.visible) {
          continue;
        }
        const px = left + coord.x * tile;
        const py = top + coord.y * tile;
        const size = Math.floor(tile * 0.42);
        ctx.drawImage(
          assets.koishiHeart,
          px + Math.floor((tile - size) * 0.5),
          py + Math.floor((tile - size) * 0.5),
          size,
          size,
        );
      }
    }

    const now = performance.now();

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
      const unit = payload.state.players[side];
      const charImage = assets.chars[unit.mechId] ?? assets.chars.reimu;
      ctx.drawImage(charImage, px + pad, py + pad, tile - pad * 2, tile - pad * 2);
      if (unit.effects.ayaSigil) {
        const markSize = Math.floor(tile * 0.42);
        ctx.drawImage(
          assets.sigil,
          px + Math.floor((tile - markSize) * 0.5),
          py + Math.floor((tile - markSize) * 0.5),
          markSize,
          markSize,
        );
      }
      ctx.strokeStyle = side === "blue" ? "#58a8ff" : "#ff6565";
      ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
      ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);

      if (unit.effects.orbTurns > 0) {
        const centerX = px + tile * 0.5;
        const centerY = py + tile * 0.5;
        const orbitRadius = tile * (0.28 + Math.min(0.5, unit.effects.orbVisionRadius * 0.04));
        const angle = now * 0.004 + (side === "blue" ? 0 : Math.PI);
        const orbSize = Math.floor(tile * 0.42);
        const orbX = centerX + Math.cos(angle) * orbitRadius - orbSize * 0.5;
        const orbY = centerY + Math.sin(angle) * orbitRadius - orbSize * 0.5;
        ctx.drawImage(assets.orbEffect, orbX, orbY, orbSize, orbSize);
      }
      drawBadgeStrip(ctx, assets, px, py, tile, getUnitDisplayBadges(unit));
    };

    drawPiece("blue");
    drawPiece("red");

    const activeSkill = payload.input.activeSkill;
    if (activeSkill === null && !payload.input.quickCast) {
      const markerSize = Math.floor(tile * 0.58);
      for (const [coordKey, markerIndex] of localMarkers) {
        const coord = keyToCoord(coordKey);
        if (!coord) {
          continue;
        }
        const marker = assets.markers[markerIndex] ?? assets.markers[0];
        const px = left + coord.x * tile;
        const py = top + coord.y * tile;
        ctx.drawImage(
          marker,
          px + Math.floor((tile - markerSize) * 0.5),
          py + Math.floor((tile - markerSize) * 0.5),
          markerSize,
          markerSize,
        );
      }
    }

    const selfMech = payload.state.players[payload.localSide].mechId;
    if (isRayIndicatorSkill(activeSkill, selfMech) && hoverCoord) {
      const self = payload.state.players[payload.localSide].pos;
      const hoverLeft = left + hoverCoord.x * tile;
      const hoverTop = top + hoverCoord.y * tile;
      const indicatorColor = activeSkill === "role4" ? "rgba(90, 170, 255, 0.95)" : "rgba(255, 66, 66, 0.95)";
      ctx.save();
      ctx.fillStyle = activeSkill === "role4" ? "rgba(90, 170, 255, 0.26)" : "rgba(255, 66, 66, 0.24)";
      ctx.fillRect(hoverLeft, hoverTop, tile, tile);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
      ctx.strokeRect(hoverLeft + 1, hoverTop + 1, tile - 2, tile - 2);
      ctx.restore();

      const lineTarget =
        activeSkill === "role4"
          ? { x: hoverCoord.x + 0.5, y: hoverCoord.y + 0.5 }
          : buildRayEdgePoint(self, hoverCoord);
      if (lineTarget) {
        const fromX = left + (self.x + 0.5) * tile;
        const fromY = top + (self.y + 0.5) * tile;
        const toX = left + lineTarget.x * tile;
        const toY = top + lineTarget.y * tile;
        if (Math.abs(toX - fromX) >= 0.01 || Math.abs(toY - fromY) >= 0.01) {
          ctx.save();
          ctx.strokeStyle = indicatorColor;
          ctx.lineWidth = Math.max(2, Math.floor(tile * 0.08));
          ctx.setLineDash([Math.max(4, Math.floor(tile * 0.22)), Math.max(2, Math.floor(tile * 0.13))]);
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }

    for (const animation of projectileAnimations) {
      if (animation.done) {
        continue;
      }
      const maxTime = animation.startedAt + animation.delayMs + animation.durationMs;
      if (now >= maxTime) {
        completeProjectile(animation);
        continue;
      }
      const renderState = getProjectileRenderState(animation, now);
      if (!renderState) {
        continue;
      }
      if (animation.actor !== payload.localSide) {
        const cx = Math.floor(renderState.pos.x);
        const cy = Math.floor(renderState.pos.y);
        if (cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_HEIGHT) {
          continue;
        }
        if (!getCell(payload.perspective.cells, cx, cy).visible) {
          continue;
        }
      }
      const image = animation.kind === "needle" ? assets.needle : animation.kind === "wind" ? assets.wind : assets.amulet;
      const px = left + renderState.pos.x * tile;
      const py = top + renderState.pos.y * tile;
      const size = Math.floor(
        tile * (animation.kind === "needle" ? 0.52 : animation.kind === "wind" ? 0.62 : 0.58),
      );

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(renderState.angle);
      ctx.drawImage(image, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();
    }
  }

  function refreshSpiritPopup(payload: RenderPayload): void {
    const activeSkill = payload.input.activeSkill;
    const show = payload.spiritSelector.visible && isVariableSkill(activeSkill);
    if (!show || !activeSkill) {
      spiritPopup.style.display = "none";
      return;
    }
    const anchor = skillButtons.get(activeSkill);
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

  function getBoardCoordFromClient(clientX: number, clientY: number): Coord | null {
    if (!boardMetrics) {
      return null;
    }
    const rect = boardCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const inside =
      x >= boardMetrics.left &&
      x < boardMetrics.left + boardMetrics.width &&
      y >= boardMetrics.top &&
      y < boardMetrics.top + boardMetrics.height;
    if (!inside) {
      return null;
    }
    return {
      x: Math.floor((x - boardMetrics.left) / boardMetrics.tile),
      y: Math.floor((y - boardMetrics.top) / boardMetrics.tile),
    };
  }

  boardCanvas.addEventListener("mousemove", (event) => {
    if (currentMode === "bp") {
      const nextHover = getBpOptionFromClient(event.clientX, event.clientY);
      if (nextHover === hoverBpOption) {
        return;
      }
      hoverBpOption = nextHover;
      if (lastBpPayload) {
        renderBp(lastBpPayload);
      }
      return;
    }

    const nextHover = getBoardCoordFromClient(event.clientX, event.clientY);
    if (coordsOrNullEqual(nextHover, hoverCoord)) {
      return;
    }
    hoverCoord = nextHover;
    if (
      lastPayload &&
      isRayIndicatorSkill(lastPayload.input.activeSkill, lastPayload.state.players[lastPayload.localSide].mechId)
    ) {
      render(lastPayload);
    }
  });

  boardCanvas.addEventListener("mouseleave", () => {
    if (currentMode === "bp") {
      if (hoverBpOption !== null) {
        hoverBpOption = null;
        if (lastBpPayload) {
          renderBp(lastBpPayload);
        }
      }
      return;
    }
    if (!hoverCoord) {
      return;
    }
    hoverCoord = null;
    if (
      lastPayload &&
      isRayIndicatorSkill(lastPayload.input.activeSkill, lastPayload.state.players[lastPayload.localSide].mechId)
    ) {
      render(lastPayload);
    }
  });

  boardCanvas.addEventListener("click", (event) => {
    hideUnlockPopup();
    hideTooltip();

    if (currentMode === "bp") {
      const optionId = getBpOptionFromClient(event.clientX, event.clientY);
      if (!optionId) {
        return;
      }
      handlers.onBpOptionClick(optionId);
      return;
    }

    const coord = getBoardCoordFromClient(event.clientX, event.clientY);
    if (!coord) {
      return;
    }
    if (lastPayload && lastPayload.input.activeSkill === null && !lastPayload.input.quickCast) {
      const selfPos = lastPayload.state.players[lastPayload.localSide].pos;
      if (coord.x !== selfPos.x || coord.y !== selfPos.y) {
        const key = coordToKey(coord);
        const clickedCell = getCell(lastPayload.perspective.cells, coord.x, coord.y);
        if (localMarkers.has(key)) {
          localMarkers.delete(key);
          render(lastPayload);
          return;
        }
        if (!clickedCell.visible) {
          localMarkers.set(key, selectedMarkerIndex);
          render(lastPayload);
          return;
        }
      }
    }
    handlers.onCellClick(coord);
  });

  function renderSkillState(payload: RenderPayload): void {
    const availability = payload.skillAvailability;
    const self = payload.state.players[payload.localSide];
    const mech = getMechDefinition(self.mechId);

    battleSkillSection.style.display = "flex";
    bpSkillSection.style.display = "none";

    for (const skill of SKILLS) {
      const skillId = skill.id;
      const button = skillButtons.get(skillId);
      if (!button) {
        continue;
      }

      const isRole = isRoleSkillId(skillId);
      const roleImplemented = isRole ? isRoleSkillImplemented(self.mechId, skillId) : true;
      const unlocked = isRole ? roleImplemented && self.skills[skillId] : true;
      const usable = unlocked && availability[skillId];

      button.classList.toggle("skill-usable", usable);
      button.classList.toggle("skill-disabled", !usable);
      button.classList.toggle("skill-selected", payload.input.activeSkill === skillId);
      button.classList.toggle("skill-quickcast", payload.input.quickCast && skillId === "move");
      button.classList.toggle("skill-locked", isRole && (!unlocked || !roleImplemented));
      button.disabled = false;

      if (isRole) {
        const roleSkill = mech.roleSkills[skillId];
        const iconSet = assets.roleIconsByMech[self.mechId]?.[skillId];
        if (iconSet) {
          const icon = payload.input.activeSkill === skillId ? iconSet.selected : usable ? iconSet.selecting : iconSet.normal;
          button.style.backgroundImage = `url('${icon.src}')`;
          button.textContent = "";
        } else {
          button.style.backgroundImage = "none";
          button.textContent = roleSkill.name || ROLE_SLOT_LABELS[skillId];
        }
      } else {
        button.style.backgroundImage = "none";
        button.textContent = skill.label;
      }
    }

    const roleBadgeValues: Partial<Record<RoleSkillId, { value: number; allowZero?: boolean }>> = {};
    if (self.mechId === "koishi") {
      if (self.effects.koishiStealthTurns > 0) {
        roleBadgeValues.role1 = { value: self.effects.koishiStealthTurns };
      }
      if (self.effects.koishiPolygraphTurns > 0) {
        roleBadgeValues.role3 = { value: self.effects.koishiPolygraphTurns };
      }
      if (self.effects.koishiPhilosophyActive) {
        roleBadgeValues.role4 = {
          value: 1,
        };
      }
    } else if (self.mechId === "aya") {
      const stealthTurns =
        self.effects.ayaStealthTurns > 0 ? self.effects.ayaStealthTurns : self.effects.ayaStealthReady ? 2 : 0;
      if (stealthTurns > 0) {
        roleBadgeValues.role3 = { value: stealthTurns };
      }
    } else if (self.effects.orbTurns > 0) {
      roleBadgeValues.role3 = { value: self.effects.orbTurns };
    }
    for (const [skill, badge] of roleDurationBadges) {
      const info = roleBadgeValues[skill];
      if (!info || !self.skills[skill] || !isRoleSkillImplemented(self.mechId, skill)) {
        badge.style.display = "none";
        continue;
      }
      const src = getDisplayNumberSrc(assets, info.value, Boolean(info.allowZero));
      if (!src) {
        badge.style.display = "none";
        continue;
      }
      badge.src = src;
      badge.style.display = "block";
    }

    endTurnButton.disabled =
      !payload.connected ||
      payload.ballisticPending ||
      payload.state.turn.acted ||
      !canEndTurn(payload.state, payload.localSide);
    endTurnButton.textContent = "\u7a7a\u8fc7";

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
      `\u5f53\u524d: ${getSideLabel(current)}` +
      (payload.ballisticPending ? " | \u5f39\u9053\u7ed3\u7b97\u4e2d" : "");
  }

  function renderStatus(payload: RenderPayload): void {
    statusTitle.textContent = "\u6570\u503c";
    const unit = payload.state.players[payload.localSide];
    statusHp.textContent = `\u751f\u547d\u503c: ${unit.stats.hp}`;
    statusSpirit.textContent =
      `\u5f53\u524d\u7075\u529b/\u7075\u529b\u4e0a\u9650: ${unit.stats.spirit}/${unit.stats.maxSpirit}`;
    statusAtk.textContent = `\u653b\u51fb\u529b: ${unit.stats.atk}`;
    statusCoord.textContent = `\u5750\u6807: ${coordToDisplayKey(unit.pos)}`;
    statusGold.textContent = `\u91d1\u5e01: ${unit.stats.gold}`;
  }

  function renderAnnouncement(payload: RenderPayload): void {
    const announcements = payload.state.announcements;
    announcementList.innerHTML = "";
    if (announcements.length === 0) {
      const empty = document.createElement("div");
      empty.className = "announcement-item";
      empty.textContent = "No announcements";
      announcementList.appendChild(empty);
      return;
    }

    const history = [...announcements].reverse();
    for (const entry of history) {
      const item = document.createElement("div");
      item.className = "announcement-item";
      if (
        entry.startsWith("P1") ||
        entry.includes("blue") ||
        entry.includes("Blue") ||
        entry.includes("\u84dd\u65b9")
      ) {
        item.classList.add("announcement-blue");
      } else if (
        entry.startsWith("P2") ||
        entry.includes("red") ||
        entry.includes("Red") ||
        entry.includes("\u7ea2\u65b9")
      ) {
        item.classList.add("announcement-red");
      }
      item.textContent = entry;
      announcementList.appendChild(item);
    }
  }

  function getBpOptionLabel(optionId: BpBanOptionId | null): string {
    if (!optionId) {
      return "Unconfirmed";
    }
    if (optionId === "none") {
      return "Empty Ban";
    }
    return getMechName(optionId);
  }

  function renderBpTurn(payload: BpRenderPayload): void {
    const turn = getBpTurn(payload.bp);
    turnBlue.classList.toggle("turn-active", Boolean(turn && turn.side === "blue"));
    turnRed.classList.toggle("turn-active", Boolean(turn && turn.side === "red"));
    turnCenter.textContent = `BP | ${getBpPhaseLabel(payload.bp)}`;
  }

  function renderBpStatus(payload: BpRenderPayload): void {
    const turn = getBpTurn(payload.bp);
    statusTitle.textContent = "BP Status";
    statusHp.textContent = `Local Side: ${getSideLabel(payload.localSide)}`;
    statusSpirit.textContent = `Phase: ${getBpPhaseLabel(payload.bp)}`;
    statusAtk.textContent = `Active Side: ${turn ? getSideLabel(turn.side) : "None"}`;
    statusCoord.textContent = `Enemy Ban On You: ${getBpOptionLabel(getBanAgainst(payload.bp, payload.localSide))}`;
    statusGold.textContent = `Your Current Selection: ${getBpOptionLabel(payload.selectedOption)}`;
  }

  function renderBpAnnouncement(payload: BpRenderPayload): void {
    const blueState = payload.bp.sides.blue;
    const redState = payload.bp.sides.red;
    const activeStep =
      payload.bp.phase === "blueBan"
        ? 1
        : payload.bp.phase === "redBan" || payload.bp.phase === "redPick"
          ? 2
          : payload.bp.phase === "bluePick"
            ? 3
            : 0;

    const rows: Array<{ side: Side; text: string; step: number }> = [
      { side: "blue", step: 1, text: `1. Blue Ban: ${getBpOptionLabel(blueState.ban)}` },
      {
        side: "red",
        step: 2,
        text: `2. Red Ban/Pick: Ban ${getBpOptionLabel(redState.ban)} | Pick ${getBpOptionLabel(redState.pick)}`,
      },
      { side: "blue", step: 3, text: `3. Blue Pick: ${getBpOptionLabel(blueState.pick)}` },
    ];

    announcementList.innerHTML = "";
    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "announcement-item";
      item.classList.add(row.side === "blue" ? "announcement-blue" : "announcement-red");
      if (row.step === activeStep) {
        item.style.borderColor = "#fff";
      }
      item.textContent = row.text;
      announcementList.appendChild(item);
    }
  }

  function renderBpSkillState(payload: BpRenderPayload): void {
    hideUnlockPopup();
    hideTooltip();
    spiritPopup.style.display = "none";
    battleSkillSection.style.display = "none";
    bpSkillSection.style.display = "flex";

    let mechId: MechId | null = null;
    if (payload.selectedOption && payload.selectedOption !== "none") {
      mechId = payload.selectedOption;
    }

    bpSkillTitle.textContent = mechId ? `${getMechName(mechId)} Skills` : "Mech Skills";
    for (const roleSkillId of ["role1", "role2", "role3", "role4"] as RoleSkillId[]) {
      const item = bpSkillItems.get(roleSkillId);
      if (!item) {
        continue;
      }
      if (!mechId) {
        item.textContent = `${ROLE_SLOT_LABELS[roleSkillId]}: Select a mech`;
        item.classList.add("bp-skill-empty");
        continue;
      }
      const roleSkill = getRoleSkillDefinition(mechId, roleSkillId);
      item.textContent = roleSkill.name
        ? `${ROLE_SLOT_LABELS[roleSkillId]}: ${roleSkill.name}`
        : `${ROLE_SLOT_LABELS[roleSkillId]}: TBD`;
      item.classList.toggle("bp-skill-empty", !roleSkill.implemented);
    }

    const turn = getBpTurn(payload.bp);
    if (!turn) {
      bpConfirmButton.textContent = "BP Done";
      bpConfirmButton.disabled = true;
      return;
    }

    if (turn.side !== payload.localSide) {
      bpConfirmButton.textContent = `Waiting for ${getSideLabel(turn.side)}`;
      bpConfirmButton.disabled = true;
      return;
    }

    const selectedOption = payload.selectedOption;
    const hasSelection = Boolean(selectedOption);
    const validSelection =
      Boolean(selectedOption) &&
      (turn.action === "ban"
        ? true
        : selectedOption !== "none" && isBpOptionEnabled(payload.bp, payload.localSide, selectedOption));

    bpConfirmButton.textContent = turn.action === "ban" ? "Confirm Ban" : "Confirm Pick";
    bpConfirmButton.disabled = !payload.connected || !hasSelection || !validSelection;
  }

  function drawBpBoard(payload: BpRenderPayload): void {
    const canvasSize = updateCanvasSize();
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { dpr, width: w, height: h } = canvasSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    boardMetrics = null;
    bpCardLayouts.length = 0;

    const turn = getBpTurn(payload.bp);
    const banAgainstLocal = getBanAgainst(payload.bp, payload.localSide);

    const paddingX = Math.max(10, Math.floor(w * 0.03));
    const paddingY = Math.max(10, Math.floor(h * 0.035));
    const sectionGap = Math.max(8, Math.floor(h * 0.02));
    const contentW = Math.max(1, w - paddingX * 2);
    const contentH = Math.max(1, h - paddingY * 2);

    const summaryH = Math.max(64, Math.floor(contentH / 3));
    const poolTop = paddingY + summaryH + sectionGap;
    const poolH = Math.max(80, h - poolTop - paddingY);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const sideGap = Math.max(8, Math.floor(contentW * 0.03));
    const sideW = Math.max(40, Math.floor((contentW - sideGap) / 2));
    const sideH = summaryH;

    const drawChoiceSlot = (
      left: number,
      top: number,
      width: number,
      height: number,
      label: string,
      value: BpBanOptionId | MechId | null,
      side: Side,
    ): void => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(left, top, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);

      const labelH = Math.max(12, Math.floor(height * 0.3));
      ctx.fillStyle = side === "blue" ? "#8abfff" : "#ff9a9a";
      ctx.font = `${Math.max(9, Math.floor(labelH * 0.6))}px 'zpix', monospace`;
      ctx.fillText(label, left + width * 0.5, top + labelH * 0.5);

      const bodyX = left + 4;
      const bodyY = top + labelH + 2;
      const bodyW = Math.max(1, width - 8);
      const bodyH = Math.max(1, height - labelH - 6);
      const bodySide = Math.max(1, Math.min(bodyW, bodyH));
      const bodySquareX = bodyX + Math.floor((bodyW - bodySide) * 0.5);
      const bodySquareY = bodyY + Math.floor((bodyH - bodySide) * 0.5);

      if (value === null) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(bodySquareX, bodySquareY, bodySide, bodySide);
        ctx.fillStyle = "#ddd";
        ctx.font = `${Math.max(9, Math.floor(bodySide * 0.2))}px 'zpix', monospace`;
        ctx.fillText("Unconfirmed", bodySquareX + bodySide * 0.5, bodySquareY + bodySide * 0.5);
        return;
      }

      if (value === "none") {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(bodySquareX, bodySquareY, bodySide, bodySide);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bodySquareX + 0.5, bodySquareY + 0.5, bodySide - 1, bodySide - 1);
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(9, Math.floor(bodySide * 0.2))}px 'zpix', monospace`;
        ctx.fillText("Empty Ban", bodySquareX + bodySide * 0.5, bodySquareY + bodySide * 0.5);
        return;
      }

      const mechId = value as MechId;
      const avatar = assets.chars[mechId];
      const srcW = Math.max(1, avatar.naturalWidth || avatar.width);
      const srcH = Math.max(1, avatar.naturalHeight || avatar.height);
      const scale = Math.min(bodySide / srcW, bodySide / srcH);
      const drawW = Math.max(1, Math.floor(srcW * scale));
      const drawH = Math.max(1, Math.floor(srcH * scale));
      const drawX = bodySquareX + Math.floor((bodySide - drawW) * 0.5);
      const drawY = bodySquareY + Math.floor((bodySide - drawH) * 0.5);
      ctx.drawImage(avatar, drawX, drawY, drawW, drawH);
      ctx.fillStyle = "rgba(0,0,0,0.56)";
      const titleH = Math.max(12, Math.floor(bodySide * 0.34));
      ctx.fillRect(bodySquareX, bodySquareY + bodySide - titleH, bodySide, titleH);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(8, Math.floor(bodySide * 0.2))}px 'zpix', monospace`;
      ctx.fillText(getMechName(mechId), bodySquareX + bodySide * 0.5, bodySquareY + bodySide - Math.max(6, Math.floor(bodySide * 0.17)));
    };

    const drawSideSummary = (side: Side, left: number): void => {
      const panelTop = paddingY;
      const panelW = sideW;
      const panelH = sideH;
      const sideState = payload.bp.sides[side];
      const sideColor = side === "blue" ? "#66adff" : "#ff6f6f";
      const panelActive = turn?.side === side;

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(left, panelTop, panelW, panelH);
      ctx.strokeStyle = panelActive ? sideColor : "rgba(255,255,255,0.5)";
      ctx.lineWidth = panelActive ? 2 : 1;
      ctx.strokeRect(left + 0.5, panelTop + 0.5, panelW - 1, panelH - 1);

      const panelPadX = Math.max(6, Math.floor(panelW * 0.045));
      const panelPadY = Math.max(6, Math.floor(panelH * 0.05));
      const panelTitleH = Math.max(14, Math.floor(panelH * 0.17));

      ctx.fillStyle = sideColor;
      ctx.font = `${Math.max(9, Math.floor(panelTitleH * 0.72))}px 'zpix', monospace`;
      ctx.fillText(side === "blue" ? "Blue Side" : "Red Side", left + panelW * 0.5, panelTop + panelPadY + panelTitleH * 0.5);

      const slotGap = Math.max(5, Math.floor(panelH * 0.04));
      const slotW = panelW - panelPadX * 2;
      const slotH = Math.max(20, Math.floor((panelH - panelPadY * 2 - panelTitleH - slotGap) / 2));
      const slotTop = panelTop + panelPadY + panelTitleH;
      drawChoiceSlot(left + panelPadX, slotTop, slotW, slotH, "Ban", sideState.ban, side);
      drawChoiceSlot(left + panelPadX, slotTop + slotH + slotGap, slotW, slotH, "Pick", sideState.pick, side);
    };

    drawSideSummary("blue", paddingX);
    drawSideSummary("red", paddingX + contentW - sideW);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(paddingX, poolTop, contentW, poolH);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(paddingX + 0.5, poolTop + 0.5, contentW - 1, poolH - 1);
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(11, Math.floor(poolH * 0.08))}px 'zpix', monospace`;
    ctx.fillText("Role Pool", paddingX + contentW * 0.5, poolTop + Math.max(12, Math.floor(poolH * 0.08)));

    const optionCount = BP_OPTIONS.length;
    const innerPadX = Math.max(10, Math.floor(contentW * 0.03));
    const innerPadBottom = Math.max(8, Math.floor(poolH * 0.06));
    const gridTop = poolTop + Math.max(18, Math.floor(poolH * 0.14));
    const gridLeft = paddingX + innerPadX;
    const gridW = Math.max(1, contentW - innerPadX * 2);
    const gridH = Math.max(1, poolTop + poolH - gridTop - innerPadBottom);
    const gap = Math.max(8, Math.floor(Math.min(gridW, gridH) * 0.03));
    const minCardSize = Math.max(68, Math.floor(Math.min(gridW, gridH) * 0.18));
    const maxColsByWidth = Math.max(1, Math.floor((gridW + gap) / (minCardSize + gap)));
    const cols = Math.max(1, Math.min(optionCount, maxColsByWidth));
    const rows = Math.max(1, Math.ceil(optionCount / cols));
    const cardWByWidth = Math.floor((gridW - gap * (cols - 1)) / cols);
    const cardWByHeight = Math.floor((gridH - gap * (rows - 1)) / rows);
    const cardW = Math.min(cardWByWidth, cardWByHeight);
    const cardH = cardW;
    if (cardW <= 0 || cardH <= 0) {
      return;
    }

    BP_OPTIONS.forEach((option, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const left = gridLeft + col * (cardW + gap);
      const top = gridTop + row * (cardH + gap);
      const enabled = payload.connected && isBpOptionEnabled(payload.bp, payload.localSide, option.id);
      const selected = payload.selectedOption === option.id;
      const hovered = hoverBpOption === option.id;
      const bannedForLocalPick = turn?.action === "pick" && banAgainstLocal === option.id;

      bpCardLayouts.push({ id: option.id, left, top, width: cardW, height: cardH });

      ctx.fillStyle = enabled ? "#050505" : "#111";
      ctx.fillRect(left, top, cardW, cardH);

      const titleH = Math.max(20, Math.floor(cardH * 0.2));
      const imagePad = Math.max(6, Math.floor(cardW * 0.06));
      const imageW = cardW - imagePad * 2;
      const imageH = cardH - titleH - imagePad * 2;
      const imageSide = Math.max(1, Math.min(imageW, imageH));
      const imageX = left + imagePad + Math.floor((imageW - imageSide) * 0.5);
      const imageY = top + imagePad + Math.floor((imageH - imageSide) * 0.5);

      if (option.id !== "none") {
        const avatar = assets.chars[option.id];
        const srcW = Math.max(1, avatar.naturalWidth || avatar.width);
        const srcH = Math.max(1, avatar.naturalHeight || avatar.height);
        const scale = Math.min(imageSide / srcW, imageSide / srcH);
        const drawW = Math.max(1, Math.floor(srcW * scale));
        const drawH = Math.max(1, Math.floor(srcH * scale));
        const drawX = imageX + Math.floor((imageSide - drawW) * 0.5);
        const drawY = imageY + Math.floor((imageSide - drawH) * 0.5);
        ctx.drawImage(avatar, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(imageX, imageY, imageSide, imageSide);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(imageX + 0.5, imageY + 0.5, imageSide - 1, imageSide - 1);
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(10, Math.floor(cardW * 0.11))}px 'zpix', monospace`;
        ctx.fillText("Empty Ban", left + cardW * 0.5, imageY + imageSide * 0.5);
      }

      if (bannedForLocalPick && option.id !== "none") {
        ctx.fillStyle = "rgba(255, 70, 70, 0.28)";
        ctx.fillRect(imageX, imageY, imageSide, imageSide);
        ctx.fillStyle = "#ff8f8f";
        ctx.font = `${Math.max(9, Math.floor(cardW * 0.09))}px 'zpix', monospace`;
        ctx.fillText("Banned For You", left + cardW * 0.5, imageY + imageSide * 0.5);
      } else if (!enabled && turn?.side === payload.localSide) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(imageX, imageY, imageSide, imageSide);
      }

      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.fillRect(left, top + cardH - titleH, cardW, titleH);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(10, Math.floor(cardW * 0.095))}px 'zpix', monospace`;
      ctx.fillText(option.name, left + cardW * 0.5, top + cardH - titleH * 0.5);

      ctx.strokeStyle = selected ? "#58a8ff" : hovered ? "#9ec8ff" : "#fff";
      ctx.lineWidth = selected ? 3 : 2;
      ctx.strokeRect(left + 0.5, top + 0.5, cardW - 1, cardH - 1);
    });
  }

  function getBpOptionFromClient(clientX: number, clientY: number): BpBanOptionId | null {
    if (bpCardLayouts.length === 0) {
      return null;
    }
    const rect = boardCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const layout of bpCardLayouts) {
      const inside =
        x >= layout.left &&
        x < layout.left + layout.width &&
        y >= layout.top &&
        y < layout.top + layout.height;
      if (inside) {
        return layout.id;
      }
    }
    return null;
  }

  function shouldContinueAnimating(payload: RenderPayload | null): boolean {
    if (!payload) {
      return false;
    }
    if (attackAnimation) {
      return true;
    }
    if (projectileAnimations.some((item) => !item.done)) {
      return true;
    }
    return payload.state.players.blue.effects.orbTurns > 0 || payload.state.players.red.effects.orbTurns > 0;
  }

  function render(payload: RenderPayload): void {
    currentMode = "battle";
    lastPayload = payload;
    lastBpPayload = null;
    hoverBpOption = null;
    drawBoard(payload);
    renderSkillState(payload);
    renderTurn(payload);
    renderStatus(payload);
    renderAnnouncement(payload);
    if (shouldContinueAnimating(payload)) {
      ensureAnimationLoop();
    }
  }

  function renderBp(payload: BpRenderPayload): void {
    currentMode = "bp";
    lastBpPayload = payload;
    drawBpBoard(payload);
    renderBpSkillState(payload);
    renderBpTurn(payload);
    renderBpStatus(payload);
    renderBpAnnouncement(payload);
  }

  function tickAnimation(): void {
    animationFrame = 0;
    if (currentMode !== "battle" || !lastPayload) {
      return;
    }

    const now = performance.now();
    for (const animation of projectileAnimations) {
      if (animation.done) {
        continue;
      }
      const maxTime = animation.startedAt + animation.delayMs + animation.durationMs;
      if (now >= maxTime) {
        completeProjectile(animation);
      }
    }

    for (let i = projectileAnimations.length - 1; i >= 0; i -= 1) {
      if (projectileAnimations[i].done) {
        projectileAnimations.splice(i, 1);
      }
    }

    render(lastPayload);
  }

  function ensureAnimationLoop(): void {
    if (animationFrame !== 0) {
      return;
    }
    animationFrame = window.requestAnimationFrame(tickAnimation);
  }

  window.addEventListener("resize", () => {
    if (currentMode === "bp" && lastBpPayload) {
      renderBp(lastBpPayload);
      return;
    }
    if (lastPayload) {
      render(lastPayload);
    }
  });

  return {
    setHandlers(nextHandlers: ViewHandlers): void {
      handlers = nextHandlers;
    },
    render,
    renderBp,
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
    playProjectileAnimations(projectiles: ProjectileEffect[]): Promise<void> {
      if (projectiles.length === 0) {
        return Promise.resolve();
      }

      const batchId = ++projectileBatchId;
      const now = performance.now();
      const valid: ProjectileAnimation[] = [];

      for (const projectile of projectiles) {
        const origin = keyToCoord(projectile.origin);
        if (!origin) {
          continue;
        }
        const path: Coord[] = [];
        for (const key of projectile.path) {
          const coord = keyToCoord(key);
          if (coord) {
            path.push(coord);
          }
        }

        const start: Coord = { x: origin.x + 0.5, y: origin.y + 0.5 };
        const fallbackEnd = path.length > 0 ? path[path.length - 1] : origin;
        const rayEnd = projectile.rayEnd;
        const end: Coord =
          rayEnd && Number.isFinite(rayEnd.x) && Number.isFinite(rayEnd.y)
            ? { x: rayEnd.x, y: rayEnd.y }
            : { x: fallbackEnd.x + 0.5, y: fallbackEnd.y + 0.5 };

        valid.push({
          id: ++projectileId,
          batchId,
          kind: projectile.kind,
          actor: projectile.actor,
          start,
          end,
          startedAt: now,
          delayMs: Math.max(0, projectile.delayMs),
          durationMs: Math.max(220, Math.max(1, path.length) * 90),
          done: false,
        });
      }

      if (valid.length === 0) {
        return Promise.resolve();
      }

      for (const item of valid) {
        projectileAnimations.push(item);
      }

      ensureAnimationLoop();

      return new Promise((resolve) => {
        projectileBatchStates.set(batchId, {
          pending: valid.length,
          resolve,
        });
      });
    },
  };
}
