import {
  ApplyOutcome,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COL_LABELS,
  Command,
  CommandEffects,
  CommandEnvelope,
  Coord,
  GameState,
  PerspectiveCell,
  PerspectiveState,
  ProjectileEffect,
  RoleSkillId,
  Side,
  TerrainType,
  UnitState,
  WallState,
  chebyshevDistance,
  coordToKey,
  coordsEqual,
  getPlayerIdBySide,
  getSideLabel,
  isCoordInBounds,
  isOrthogonalStep,
  keyToCoord,
  oppositeSide,
} from "./protocol";

const BLUE_SPAWN: Coord = { x: 1, y: 4 }; // B5
const RED_SPAWN: Coord = { x: 10, y: 4 }; // K5
const SKILL_UNLOCK_COST = 100;
const NEEDLE_INTERVAL_MS = 140;
const MAX_ANNOUNCEMENTS = 80;
const RAY_EPSILON = 1e-9;

const INITIAL_WALL_COORDS: Coord[] = [];
for (let y = 3; y <= 8; y += 1) {
  INITIAL_WALL_COORDS.push({ x: 3, y }); // D4:D9
  INITIAL_WALL_COORDS.push({ x: 8, y }); // I4:I9
}
const INITIAL_WALL_KEYS = new Set(INITIAL_WALL_COORDS.map((item) => coordToKey(item)));

export interface QuickCastTargets {
  moveTargets: Coord[];
  attackTargets: Coord[];
}

function isInRect(coord: Coord, minX: number, minY: number, maxX: number, maxY: number): boolean {
  return coord.x >= minX && coord.x <= maxX && coord.y >= minY && coord.y <= maxY;
}

export function isGrass(coord: Coord): boolean {
  return (
    isInRect(coord, 2, 0, 4, 1) || // C1:E2
    isInRect(coord, 7, 0, 9, 1) || // H1:J2
    isInRect(coord, 4, 7, 7, 8) // E8:H9
  );
}

export function getBaseTerrain(coord: Coord): TerrainType {
  if (coordsEqual(coord, BLUE_SPAWN)) {
    return "spawnBlue";
  }
  if (coordsEqual(coord, RED_SPAWN)) {
    return "spawnRed";
  }
  if (isGrass(coord)) {
    return "grass";
  }
  return "ground";
}

function createUnit(side: Side, pos: Coord, initialSpirit: number): UnitState {
  return {
    id: getPlayerIdBySide(side),
    side,
    pos: { ...pos },
    stats: {
      hp: 10,
      spirit: initialSpirit,
      maxSpirit: 25,
      atk: 1,
      vision: 1,
      moveRange: 1,
      gold: 100,
    },
    skills: {
      role1: false,
      role2: false,
      role3: false,
      role4: false,
    },
    effects: {
      orbVisionRadius: 0,
      orbTurns: 0,
    },
  };
}

function createWalls(): Record<string, WallState> {
  const walls: Record<string, WallState> = {};
  for (const coord of INITIAL_WALL_COORDS) {
    walls[coordToKey(coord)] = {
      hp: 5,
      maxHp: 5,
      alive: true,
    };
  }
  return walls;
}

function cloneUnit(unit: UnitState): UnitState {
  return {
    ...unit,
    pos: { ...unit.pos },
    stats: { ...unit.stats },
    skills: { ...unit.skills },
    effects: { ...unit.effects },
  };
}

function clonePlayers(players: Record<Side, UnitState>): Record<Side, UnitState> {
  return {
    blue: cloneUnit(players.blue),
    red: cloneUnit(players.red),
  };
}

function cloneWalls(walls: Record<string, WallState>): Record<string, WallState> {
  const next: Record<string, WallState> = {};
  for (const key of Object.keys(walls)) {
    next[key] = { ...walls[key] };
  }
  return next;
}

export function createInitialState(): GameState {
  return {
    seq: 0,
    turn: {
      side: "blue",
      round: 1,
      acted: false,
      pendingAnnouncement: null,
    },
    players: {
      blue: createUnit("blue", BLUE_SPAWN, 0),
      red: createUnit("red", RED_SPAWN, 1),
    },
    walls: createWalls(),
    announcements: [],
    winner: null,
  };
}

export function createMoveCommand(actor: Side, to: Coord): Command {
  return {
    type: "move",
    actor,
    to: coordToKey(to),
  };
}

export function createBuildCommand(actor: Side, to: Coord, spirit: number): Command {
  return {
    type: "build",
    actor,
    to: coordToKey(to),
    spirit,
  };
}

export function createScoutCommand(actor: Side): Command {
  return {
    type: "scout",
    actor,
  };
}

export function createAttackCommand(actor: Side, to: Coord): Command {
  return {
    type: "attack",
    actor,
    to: coordToKey(to),
  };
}

export function createNeedleCommand(actor: Side, to: Coord, spirit: number): Command {
  return {
    type: "needle",
    actor,
    to: coordToKey(to),
    spirit,
  };
}

export function createAmuletCommand(actor: Side, to: Coord): Command {
  return {
    type: "amulet",
    actor,
    to: coordToKey(to),
    spirit: 1,
  };
}

export function createOrbCommand(actor: Side, spirit: number): Command {
  return {
    type: "orb",
    actor,
    spirit,
  };
}

export function createBlinkCommand(actor: Side, to: Coord, spirit: number): Command {
  return {
    type: "blink",
    actor,
    to: coordToKey(to),
    spirit,
  };
}

export function createUnlockSkillCommand(actor: Side, skill: RoleSkillId): Command {
  return {
    type: "unlockSkill",
    actor,
    skill,
  };
}

export function createEndTurnCommand(actor: Side): Command {
  return {
    type: "endTurn",
    actor,
  };
}

function canIssueCommandByTurn(state: GameState, actor: Side): boolean {
  return !state.winner && state.turn.side === actor;
}

function canIssueAction(state: GameState, actor: Side): boolean {
  return canIssueCommandByTurn(state, actor) && !state.turn.acted;
}

export function canEndTurn(state: GameState, actor: Side): boolean {
  return canIssueCommandByTurn(state, actor);
}

function containsCoord(list: Coord[], target: Coord): boolean {
  return list.some((item) => coordsEqual(item, target));
}

function isWallAliveAt(state: GameState, coord: Coord): boolean {
  return Boolean(state.walls[coordToKey(coord)]?.alive);
}

function isWallAliveInMap(walls: Record<string, WallState>, coord: Coord): boolean {
  return Boolean(walls[coordToKey(coord)]?.alive);
}

function hasAnyUnitAt(state: GameState, coord: Coord): boolean {
  return (
    isWallAliveAt(state, coord) ||
    coordsEqual(state.players.blue.pos, coord) ||
    coordsEqual(state.players.red.pos, coord)
  );
}

function isAttackTargetAt(state: GameState, actor: Side, coord: Coord): boolean {
  if (isWallAliveAt(state, coord)) {
    return true;
  }
  const enemy = state.players[oppositeSide(actor)];
  return coordsEqual(enemy.pos, coord);
}

function floorDamage(value: number): number {
  return Math.max(0, Math.floor(value));
}

function getWinnerFromPlayers(state: GameState): Side | null {
  if (state.players.blue.stats.hp <= 0) {
    return "red";
  }
  if (state.players.red.stats.hp <= 0) {
    return "blue";
  }
  return null;
}

function getVisionRadius(state: GameState, side: Side): number {
  const unit = state.players[side];
  if (unit.effects.orbTurns > 0) {
    return Math.max(unit.stats.vision, unit.effects.orbVisionRadius);
  }
  return unit.stats.vision;
}

interface RayPathCell {
  coord: Coord;
  enterT: number;
  exitT: number;
}

interface RayPath {
  cells: RayPathCell[];
  startX: number;
  startY: number;
  dirX: number;
  dirY: number;
  maxT: number;
}

function computeRayMaxT(startX: number, startY: number, dirX: number, dirY: number): number {
  let maxT = Number.POSITIVE_INFINITY;
  if (dirX > 0) {
    maxT = Math.min(maxT, (BOARD_WIDTH - startX) / dirX);
  } else if (dirX < 0) {
    maxT = Math.min(maxT, (0 - startX) / dirX);
  }
  if (dirY > 0) {
    maxT = Math.min(maxT, (BOARD_HEIGHT - startY) / dirY);
  } else if (dirY < 0) {
    maxT = Math.min(maxT, (0 - startY) / dirY);
  }
  return maxT;
}

function intersectRayCell(
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxT: number,
  cellX: number,
  cellY: number,
): { enterT: number; exitT: number } | null {
  const minX = cellX;
  const maxX = cellX + 1;
  const minY = cellY;
  const maxY = cellY + 1;
  let enterT = 0;
  let exitT = maxT;

  if (Math.abs(dirX) <= RAY_EPSILON) {
    if (startX < minX || startX > maxX) {
      return null;
    }
  } else {
    const tx1 = (minX - startX) / dirX;
    const tx2 = (maxX - startX) / dirX;
    const txEnter = Math.min(tx1, tx2);
    const txExit = Math.max(tx1, tx2);
    enterT = Math.max(enterT, txEnter);
    exitT = Math.min(exitT, txExit);
  }

  if (Math.abs(dirY) <= RAY_EPSILON) {
    if (startY < minY || startY > maxY) {
      return null;
    }
  } else {
    const ty1 = (minY - startY) / dirY;
    const ty2 = (maxY - startY) / dirY;
    const tyEnter = Math.min(ty1, ty2);
    const tyExit = Math.max(ty1, ty2);
    enterT = Math.max(enterT, tyEnter);
    exitT = Math.min(exitT, tyExit);
  }

  if (exitT < enterT - RAY_EPSILON) {
    return null;
  }
  if (exitT <= RAY_EPSILON) {
    return null;
  }

  return {
    enterT: Math.max(0, enterT),
    exitT: Math.max(0, Math.min(maxT, exitT)),
  };
}

function buildRayPath(from: Coord, to: Coord): RayPath | null {
  const startX = from.x + 0.5;
  const startY = from.y + 0.5;
  const targetX = to.x + 0.5;
  const targetY = to.y + 0.5;
  const dirX = targetX - startX;
  const dirY = targetY - startY;
  if (Math.abs(dirX) <= RAY_EPSILON && Math.abs(dirY) <= RAY_EPSILON) {
    return null;
  }

  const maxT = computeRayMaxT(startX, startY, dirX, dirY);
  if (!Number.isFinite(maxT) || maxT <= 0) {
    return null;
  }

  const cells: RayPathCell[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (x === from.x && y === from.y) {
        continue;
      }
      const hit = intersectRayCell(startX, startY, dirX, dirY, maxT, x, y);
      if (!hit) {
        continue;
      }
      cells.push({
        coord: { x, y },
        enterT: hit.enterT,
        exitT: hit.exitT,
      });
    }
  }

  cells.sort((a, b) => {
    const enterDelta = a.enterT - b.enterT;
    if (Math.abs(enterDelta) > RAY_EPSILON) {
      return enterDelta;
    }
    const exitDelta = a.exitT - b.exitT;
    if (Math.abs(exitDelta) > RAY_EPSILON) {
      return exitDelta;
    }
    if (a.coord.y !== b.coord.y) {
      return a.coord.y - b.coord.y;
    }
    return a.coord.x - b.coord.x;
  });

  return {
    cells,
    startX,
    startY,
    dirX,
    dirY,
    maxT,
  };
}

function getRayPoint(path: RayPath, t: number): Coord {
  const clampedT = Math.max(0, Math.min(path.maxT, t));
  return {
    x: path.startX + path.dirX * clampedT,
    y: path.startY + path.dirY * clampedT,
  };
}

function applyEnemyDamage(
  players: Record<Side, UnitState>,
  targetSide: Side,
  amount: number,
  damageAnnouncements: string[],
): boolean {
  if (amount <= 0) {
    return false;
  }
  const target = players[targetSide];
  if (target.stats.hp <= 0) {
    return false;
  }
  const hpAfter = Math.max(0, target.stats.hp - amount);
  target.stats.hp = hpAfter;
  damageAnnouncements.push(`${getSideLabel(targetSide)}\u53d7\u5230\u4e86${amount}\u70b9\u4f24\u5bb3`);
  return true;
}

function applyWallDamage(
  players: Record<Side, UnitState>,
  walls: Record<string, WallState>,
  actor: Side,
  coord: Coord,
  amount: number,
): boolean {
  if (amount <= 0) {
    return false;
  }
  const key = coordToKey(coord);
  const wall = walls[key];
  if (!wall || !wall.alive) {
    return false;
  }
  const hpAfter = wall.hp - amount;
  if (hpAfter <= 0) {
    const reward = 10 * wall.maxHp;
    players[actor].stats.gold += reward;
    walls[key] = {
      ...wall,
      hp: 0,
      alive: false,
    };
  } else {
    walls[key] = {
      ...wall,
      hp: hpAfter,
    };
  }
  return true;
}

function buildProjectileEffect(
  kind: "needle" | "amulet",
  actor: Side,
  origin: Coord,
  path: Coord[],
  delayMs: number,
  rayEnd?: Coord,
): ProjectileEffect {
  return {
    kind,
    actor,
    origin: coordToKey(origin),
    path: path.map((cell) => coordToKey(cell)),
    delayMs,
    ...(rayEnd ? { rayEnd } : {}),
  };
}

function appendAnnouncements(base: string[], additions: string[]): string[] {
  if (additions.length === 0) {
    if (base.length <= MAX_ANNOUNCEMENTS) {
      return base;
    }
    return base.slice(base.length - MAX_ANNOUNCEMENTS);
  }
  const merged = [...base, ...additions];
  if (merged.length <= MAX_ANNOUNCEMENTS) {
    return merged;
  }
  return merged.slice(merged.length - MAX_ANNOUNCEMENTS);
}

function formatTurnAnnouncement(round: number, side: Side, text: string): string {
  const playerNo = side === "blue" ? 1 : 2;
  return `[回合${round}P${playerNo}: ${text}]`;
}

function appendTurnAnnouncements(
  base: string[],
  round: number,
  side: Side,
  additions: string[],
): string[] {
  if (additions.length === 0) {
    return appendAnnouncements(base, []);
  }
  return appendAnnouncements(
    base,
    additions.map((text) => formatTurnAnnouncement(round, side, text)),
  );
}

function formatCoordDisplay(coord: Coord): string {
  return `${COL_LABELS[coord.x]}:${coord.y + 1}`;
}

export function getLegalMoveTargets(state: GameState, actor: Side): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }

  const result: Coord[] = [];
  const self = state.players[actor];
  const enemy = state.players[oppositeSide(actor)];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const target: Coord = { x: self.pos.x + dx, y: self.pos.y + dy };
      if (!isCoordInBounds(target)) {
        continue;
      }
      if (chebyshevDistance(self.pos, target) > self.stats.moveRange) {
        continue;
      }
      if (isWallAliveAt(state, target)) {
        continue;
      }
      if (coordsEqual(enemy.pos, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}

export function getLegalBuildTargets(state: GameState, actor: Side, spiritSpend: number): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (!Number.isInteger(spiritSpend) || spiritSpend <= 0) {
    return [];
  }
  if (state.players[actor].stats.spirit < spiritSpend) {
    return [];
  }

  const result: Coord[] = [];
  const self = state.players[actor];

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target: Coord = { x, y };
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > spiritSpend) {
        continue;
      }
      if (hasAnyUnitAt(state, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}

export function canUseScout(state: GameState, actor: Side): boolean {
  return canIssueAction(state, actor) && state.players[actor].stats.spirit >= 1;
}

export function getLegalAttackTargets(state: GameState, actor: Side): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }

  const result: Coord[] = [];
  const self = state.players[actor];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const target: Coord = { x: self.pos.x + dx, y: self.pos.y + dy };
      if (!isCoordInBounds(target)) {
        continue;
      }
      if (chebyshevDistance(self.pos, target) > 1) {
        continue;
      }
      if (!isAttackTargetAt(state, actor, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}

export function getLegalBlinkTargets(state: GameState, actor: Side, spiritSpend: number): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (!Number.isInteger(spiritSpend) || spiritSpend <= 0) {
    return [];
  }
  if (state.players[actor].stats.spirit < spiritSpend) {
    return [];
  }
  if (!state.players[actor].skills.role4) {
    return [];
  }

  const self = state.players[actor];
  const result: Coord[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target: Coord = { x, y };
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > spiritSpend) {
        continue;
      }
      if (hasAnyUnitAt(state, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}

export function getQuickCastTargets(state: GameState, actor: Side): QuickCastTargets {
  const moveTargets = getLegalMoveTargets(state, actor);
  const attackTargets = getLegalAttackTargets(state, actor).filter(
    (coord) => !containsCoord(moveTargets, coord),
  );
  return {
    moveTargets,
    attackTargets,
  };
}

function applyMove(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "move") {
    return { ok: false, reason: "invalid move command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const legal = containsCoord(getLegalMoveTargets(state, actor), target);
  if (!legal) {
    return { ok: false, reason: "illegal move target" };
  }

  const self = state.players[actor];
  const nextSpirit = isOrthogonalStep(self.pos, target)
    ? Math.min(self.stats.maxSpirit, self.stats.spirit + 1)
    : self.stats.spirit;

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].pos = { ...target };
  nextPlayers[actor].stats.spirit = nextSpirit;

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}移动到${formatCoordDisplay(target)}`,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
  };
  return { ok: true, state: nextState };
}

function applyBuild(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "build") {
    return { ok: false, reason: "invalid build command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (state.players[actor].stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }
  const legal = containsCoord(getLegalBuildTargets(state, actor, command.spirit), target);
  if (!legal) {
    return { ok: false, reason: "illegal build target" };
  }

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;

  const wallKey = coordToKey(target);
  const nextWalls = cloneWalls(state.walls);
  nextWalls[wallKey] = {
    hp: command.spirit,
    maxHp: command.spirit,
    alive: true,
  };

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}在${formatCoordDisplay(target)}建造了生命上限为${command.spirit}的墙体`,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
  };
  return { ok: true, state: nextState };
}

function applyScout(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "scout") {
    return { ok: false, reason: "invalid scout command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }

  const enemy = state.players[oppositeSide(actor)];
  const scoutResult = isGrass(enemy.pos)
    ? "目标位于草丛中，无法被侦察"
    : `目标坐标为${formatCoordDisplay(enemy.pos)}`;

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= 1;

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}进行了侦察，${scoutResult}`,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
  };
  return { ok: true, state: nextState };
}

function applyAttack(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "attack") {
    return { ok: false, reason: "invalid attack command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const self = state.players[actor];
  if (chebyshevDistance(self.pos, target) > 1 || coordsEqual(self.pos, target)) {
    return { ok: false, reason: "attack target out of range" };
  }
  if (!isAttackTargetAt(state, actor, target)) {
    return { ok: false, reason: "no valid target in tile" };
  }

  const damage = floorDamage(self.stats.atk);
  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements: string[] = [];

  if (coordsEqual(nextPlayers[enemySide].pos, target)) {
    applyEnemyDamage(nextPlayers, enemySide, damage, damageAnnouncements);
  }
  applyWallDamage(nextPlayers, nextWalls, actor, target, damage);

  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls,
  });

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}对${formatCoordDisplay(target)}发动了普通攻击`,
      ...damageAnnouncements,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
    winner,
  };
  return { ok: true, state: nextState };
}

function applyUnlockSkill(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "unlockSkill") {
    return { ok: false, reason: "invalid unlock command type" };
  }
  const actor = command.actor;
  if (!canIssueCommandByTurn(state, actor)) {
    return { ok: false, reason: "cannot unlock now" };
  }

  const self = state.players[actor];
  if (self.skills[command.skill]) {
    return { ok: false, reason: "skill already unlocked" };
  }
  if (self.stats.gold < SKILL_UNLOCK_COST) {
    return { ok: false, reason: "not enough gold" };
  }

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.gold -= SKILL_UNLOCK_COST;
  nextPlayers[actor].skills[command.skill] = true;

  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
    },
  };
}

function applyNeedle(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "needle") {
    return { ok: false, reason: "invalid needle command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!self.skills.role1) {
    return { ok: false, reason: "skill role1 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const ray = buildRayPath(self.pos, target);
  if (!ray || ray.cells.length === 0) {
    return { ok: false, reason: "invalid needle direction" };
  }

  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements: string[] = [];
  const projectiles: ProjectileEffect[] = [];

  for (let index = 0; index < command.spirit; index += 1) {
    const traveled: Coord[] = [];
    let traveledExitT = 0;
    let endT = ray.maxT;
    let cellIndex = 0;

    while (cellIndex < ray.cells.length) {
      const groupEnterT = ray.cells[cellIndex].enterT;
      const group: RayPathCell[] = [];

      while (
        cellIndex < ray.cells.length &&
        Math.abs(ray.cells[cellIndex].enterT - groupEnterT) <= RAY_EPSILON
      ) {
        const hit = ray.cells[cellIndex];
        group.push(hit);
        traveled.push(hit.coord);
        traveledExitT = Math.max(traveledExitT, hit.exitT);
        cellIndex += 1;
      }

      let groupHit = false;
      for (const hit of group) {
        if (isWallAliveInMap(nextWalls, hit.coord)) {
          applyWallDamage(nextPlayers, nextWalls, actor, hit.coord, 1);
          groupHit = true;
        }
      }
      for (const hit of group) {
        if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
          groupHit = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements) || groupHit;
        }
      }

      if (groupHit) {
        endT = Math.max(groupEnterT + RAY_EPSILON, traveledExitT);
        break;
      }
    }

    if (traveledExitT > RAY_EPSILON && endT === ray.maxT) {
      endT = traveledExitT;
    }

    const rayEnd = getRayPoint(ray, endT);
    projectiles.push(
      buildProjectileEffect(
        "needle",
        actor,
        nextPlayers[actor].pos,
        traveled,
        index * NEEDLE_INTERVAL_MS,
        rayEnd,
      ),
    );
  }

  nextPlayers[actor].stats.spirit -= command.spirit;

  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls,
  });

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}朝${formatCoordDisplay(target)}发射了封魔针`,
      ...damageAnnouncements,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
    winner,
  };

  const effects: CommandEffects = {
    projectiles,
  };

  return {
    ok: true,
    state: nextState,
    effects,
  };
}

function applyAmulet(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "amulet") {
    return { ok: false, reason: "invalid amulet command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!self.skills.role2) {
    return { ok: false, reason: "skill role2 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit !== 1) {
    return { ok: false, reason: "amulet spirit must be 1" };
  }
  if (self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const ray = buildRayPath(self.pos, target);
  if (!ray || ray.cells.length === 0) {
    return { ok: false, reason: "invalid amulet direction" };
  }

  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements: string[] = [];
  const traveled: Coord[] = [];
  let hitEnemy = false;

  for (const hit of ray.cells) {
    traveled.push(hit.coord);
    if (isWallAliveInMap(nextWalls, hit.coord)) {
      applyWallDamage(nextPlayers, nextWalls, actor, hit.coord, 1);
    }
    if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
      hitEnemy = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements) || hitEnemy;
    }
  }

  const spiritAfter = nextPlayers[actor].stats.spirit - 1 + (hitEnemy ? 1 : 0);
  nextPlayers[actor].stats.spirit = Math.max(
    0,
    Math.min(nextPlayers[actor].stats.maxSpirit, spiritAfter),
  );

  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls,
  });

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      `${getSideLabel(actor)}朝${formatCoordDisplay(target)}发射了符札`,
      ...damageAnnouncements,
    ]),
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: null,
    },
    winner,
  };

  return {
    ok: true,
    state: nextState,
    effects: {
      projectiles: [
        buildProjectileEffect(
          "amulet",
          actor,
          nextPlayers[actor].pos,
          traveled,
          0,
          getRayPoint(ray, ray.maxT),
        ),
      ],
    },
  };
}

function applyOrb(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "orb") {
    return { ok: false, reason: "invalid orb command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!self.skills.role3) {
    return { ok: false, reason: "skill role3 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].effects.orbVisionRadius = command.spirit;
  nextPlayers[actor].effects.orbTurns = command.spirit;

  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `${getSideLabel(actor)}获得了半径为${command.spirit}的视野`,
      ]),
      turn: {
        ...state.turn,
        acted: true,
        pendingAnnouncement: null,
      },
    },
  };
}

function applyBlink(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "blink") {
    return { ok: false, reason: "invalid blink command type" };
  }
  const actor = command.actor;
  if (!canIssueAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!self.skills.role4) {
    return { ok: false, reason: "skill role4 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const legal = containsCoord(getLegalBlinkTargets(state, actor, command.spirit), target);
  if (!legal) {
    return { ok: false, reason: "illegal blink target" };
  }

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].pos = { ...target };

  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `${getSideLabel(actor)}闪现到了${formatCoordDisplay(target)}`,
      ]),
      turn: {
        ...state.turn,
        acted: true,
        pendingAnnouncement: null,
      },
    },
  };
}

function decrementOrbWhenTurnStarts(players: Record<Side, UnitState>, enteringSide: Side): void {
  const effect = players[enteringSide].effects;
  if (effect.orbTurns <= 0) {
    return;
  }
  effect.orbTurns = Math.max(0, effect.orbTurns - 1);
  if (effect.orbTurns === 0) {
    effect.orbVisionRadius = 0;
  }
}

function advanceTurnState(state: GameState, actor: Side): GameState {
  const nextSide = oppositeSide(actor);
  const nextRound = actor === "red" ? state.turn.round + 1 : state.turn.round;
  const nextPlayers = clonePlayers(state.players);
  decrementOrbWhenTurnStarts(nextPlayers, nextSide);
  return {
    ...state,
    players: nextPlayers,
    turn: {
      side: nextSide,
      round: nextRound,
      acted: false,
      pendingAnnouncement: null,
    },
  };
}

function applyEndTurn(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "endTurn") {
    return { ok: false, reason: "invalid endTurn command type" };
  }
  if (state.winner) {
    return { ok: false, reason: "game has ended" };
  }
  const actor = command.actor;
  if (!canEndTurn(state, actor)) {
    return { ok: false, reason: "cannot end turn now" };
  }
  if (state.turn.acted) {
    return { ok: false, reason: "endTurn is pass-only after actions auto-end" };
  }

  return {
    ok: true,
    state: advanceTurnState(
      {
        ...state,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          `${getSideLabel(actor)}选择了空过`,
        ]),
      },
      actor,
    ),
  };
}

function applyCommand(state: GameState, command: Command): ApplyOutcome {
  if (state.winner) {
    return { ok: false, reason: "game has ended" };
  }
  let applied: ApplyOutcome;
  switch (command.type) {
    case "move":
      applied = applyMove(state, command);
      break;
    case "build":
      applied = applyBuild(state, command);
      break;
    case "scout":
      applied = applyScout(state, command);
      break;
    case "attack":
      applied = applyAttack(state, command);
      break;
    case "needle":
      applied = applyNeedle(state, command);
      break;
    case "amulet":
      applied = applyAmulet(state, command);
      break;
    case "orb":
      applied = applyOrb(state, command);
      break;
    case "blink":
      applied = applyBlink(state, command);
      break;
    case "unlockSkill":
      applied = applyUnlockSkill(state, command);
      break;
    case "endTurn":
      applied = applyEndTurn(state, command);
      break;
    default:
      return { ok: false, reason: "unsupported command" };
  }

  if (!applied.ok) {
    return applied;
  }

  if (command.type === "endTurn" || command.type === "unlockSkill" || applied.state.winner) {
    return applied;
  }

  return {
    ok: true,
    state: advanceTurnState(applied.state, command.actor),
    effects: applied.effects,
  };
}

export function applyCommandEnvelope(state: GameState, envelope: CommandEnvelope): ApplyOutcome {
  const expectedSeq = state.seq + 1;
  if (envelope.seq !== expectedSeq) {
    return {
      ok: false,
      reason: `sequence mismatch, expect ${expectedSeq}, got ${envelope.seq}`,
    };
  }
  const applied = applyCommand(state, envelope.command);
  if (!applied.ok) {
    return applied;
  }
  return {
    ok: true,
    state: {
      ...applied.state,
      seq: envelope.seq,
    },
    effects: applied.effects,
  };
}

function isVisibleFrom(state: GameState, observerSide: Side, coord: Coord): boolean {
  const self = state.players[observerSide];
  if (chebyshevDistance(self.pos, coord) > getVisionRadius(state, observerSide)) {
    return false;
  }
  const observerInGrass = isGrass(self.pos);
  const targetInGrass = isGrass(coord);
  if (!observerInGrass && targetInGrass && !coordsEqual(coord, self.pos)) {
    return false;
  }
  return true;
}

function buildCell(state: GameState, observerSide: Side, coord: Coord): PerspectiveCell {
  const key = coordToKey(coord);
  const visible = isVisibleFrom(state, observerSide, coord);
  const initialWall = INITIAL_WALL_KEYS.has(key);
  const liveWall = Boolean(state.walls[key]?.alive);
  const hasWall = visible ? liveWall : initialWall;
  const wallHp = visible && liveWall ? state.walls[key].hp : null;

  return {
    coord,
    terrain: getBaseTerrain(coord),
    visible,
    hasWall,
    wallHp,
  };
}

export function buildPerspective(state: GameState, side: Side): PerspectiveState {
  const cells: PerspectiveCell[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      cells.push(buildCell(state, side, { x, y }));
    }
  }

  const self = state.players[side];
  const enemySide = oppositeSide(side);
  const enemyPos = state.players[enemySide].pos;
  const enemyVisible = isVisibleFrom(state, side, enemyPos);

  return {
    side,
    cells,
    pieces: {
      [side]: { ...self.pos },
      ...(enemyVisible ? { [enemySide]: { ...enemyPos } } : {}),
    },
  };
}

function stableSerializeState(state: GameState): string {
  const wallKeys = Object.keys(state.walls).sort();
  const wallData = wallKeys.map((key) => {
    const wall = state.walls[key];
    return `${key}:${wall.alive ? 1 : 0}:${wall.hp}:${wall.maxHp}`;
  });
  return JSON.stringify({
    seq: state.seq,
    turn: state.turn,
    blue: state.players.blue,
    red: state.players.red,
    walls: wallData,
    announcements: state.announcements,
    winner: state.winner,
  });
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeStateHash(state: GameState): string {
  return fnv1a(stableSerializeState(state));
}

export function formatCoordXY(coord: Coord): string {
  return formatCoordDisplay(coord);
}

export function formatCoordAlphaNumeric(coord: Coord): string {
  return formatCoordDisplay(coord);
}
