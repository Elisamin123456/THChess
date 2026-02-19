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
  MechId,
  PendingActionKind,
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
import { DEFAULT_MECH_ID, isRoleSkillImplemented } from "./mech";

const BLUE_SPAWN: Coord = { x: 1, y: 4 }; // B5
const RED_SPAWN: Coord = { x: 10, y: 4 }; // K5
const SKILL_UNLOCK_COST = 100;
const NEEDLE_INTERVAL_MS = 140;
const MAX_ANNOUNCEMENTS = 80;
const RAY_EPSILON = 1e-9;
const AYA_STEALTH_TURNS = 2;
const KOISHI_ROLE4_COST = 5;

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

function getBaseMaxSpiritByMech(mechId: MechId): number {
  if (mechId === "aya") {
    return 5;
  }
  if (mechId === "koishi") {
    return 10;
  }
  return 25;
}

function getBaseHpByMech(mechId: MechId): number {
  return mechId === "koishi" ? 5 : 10;
}

function getBaseAtkByMech(mechId: MechId): number {
  return mechId === "koishi" ? 2 : 1;
}

function createUnit(side: Side, pos: Coord, initialSpirit: number, mechId: MechId): UnitState {
  const maxSpirit = getBaseMaxSpiritByMech(mechId);
  return {
    id: getPlayerIdBySide(side),
    side,
    mechId,
    pos: { ...pos },
    stats: {
      hp: getBaseHpByMech(mechId),
      spirit: Math.max(0, Math.min(maxSpirit, initialSpirit)),
      maxSpirit,
      atk: getBaseAtkByMech(mechId),
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
      ayaStealthReady: false,
      ayaStealthTurns: 0,
      ayaNextAttackBuff: false,
      ayaNextMoveBuff: false,
      ayaSigil: false,
      koishiStealthTurns: 0,
      koishiHeartAuraActive: false,
      koishiPolygraphTurns: 0,
      koishiPhilosophyActive: false,
      koishiPhilosophyHits: 0,
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
      ayaSigil: false,
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

function isAya(state: GameState, side: Side): boolean {
  return state.players[side].mechId === "aya";
}

function isAyaUnit(unit: UnitState): boolean {
  return unit.mechId === "aya";
}

function isKoishi(state: GameState, side: Side): boolean {
  return state.players[side].mechId === "koishi";
}

function isKoishiUnit(unit: UnitState): boolean {
  return unit.mechId === "koishi";
}

function canIssuePrimaryAction(state: GameState, actor: Side): boolean {
  return canIssueAction(state, actor) && state.turn.pendingAction === null;
}

function clearTurnPending(turn: GameState["turn"]): GameState["turn"] {
  return {
    ...turn,
    pendingAnnouncement: null,
    pendingAction: null,
    pendingActionCanTriggerPassive: false,
  };
}

function markTurnActionEnded(turn: GameState["turn"]): GameState["turn"] {
  return {
    ...clearTurnPending(turn),
    acted: true,
  };
}

function markTurnPendingAction(
  turn: GameState["turn"],
  pendingAction: PendingActionKind,
  canTriggerPassive: boolean,
): GameState["turn"] {
  return {
    ...clearTurnPending(turn),
    acted: false,
    pendingAction,
    pendingActionCanTriggerPassive: canTriggerPassive,
  };
}

function getAyaDisguiseAnnouncements(actor: Side): string[] {
  return [
    `${getSideLabel(actor)}进行了移动`,
    `${getSideLabel(actor)}进行了建造`,
    `${getSideLabel(actor)}进行了侦察`,
    `${getSideLabel(actor)}进行了普通攻击`,
    "文发射了旋风",
    "文进行了强化",
    "文进行了位移",
  ];
}

function pickAyaRandomAnnouncement(state: GameState, actor: Side, salt: string): string {
  const self = state.players[actor];
  const input = `${state.seq}|${state.turn.round}|${actor}|${salt}|${self.pos.x},${self.pos.y}|${self.stats.hp}|${self.stats.spirit}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const pool = getAyaDisguiseAnnouncements(actor);
  const index = Math.abs(hash >>> 0) % pool.length;
  return pool[index];
}

function shouldUseAyaRandomAnnouncement(state: GameState, actor: Side, forceRandom: boolean): boolean {
  if (!isAya(state, actor)) {
    return false;
  }
  if (forceRandom) {
    return true;
  }
  return state.players[actor].effects.ayaStealthTurns > 0;
}

function resolvePrimaryAnnouncement(
  state: GameState,
  actor: Side,
  text: string,
  salt: string,
  forceRandom = false,
): string {
  if (isKoishi(state, actor)) {
    return "";
  }
  if (!shouldUseAyaRandomAnnouncement(state, actor, forceRandom)) {
    return text;
  }
  return pickAyaRandomAnnouncement(state, actor, salt);
}

function activateAyaStealthIfReady(unit: UnitState): void {
  if (!isAyaUnit(unit) || !unit.effects.ayaStealthReady) {
    return;
  }
  unit.effects.ayaStealthReady = false;
  unit.effects.ayaStealthTurns = AYA_STEALTH_TURNS;
}

function canUseRoleSkillByMech(state: GameState, side: Side, skill: RoleSkillId): boolean {
  return isRoleSkillImplemented(state.players[side].mechId, skill);
}

export function canUseRoleSkillByState(state: GameState, side: Side, skill: RoleSkillId): boolean {
  if (state.turn.side !== side || state.turn.acted || state.turn.pendingAction !== null) {
    return false;
  }
  return canUseRoleSkillByMech(state, side, skill);
}

export function createInitialState(mechBySide?: Partial<Record<Side, MechId>>): GameState {
  const blueMech = mechBySide?.blue ?? DEFAULT_MECH_ID;
  const redMech = mechBySide?.red ?? DEFAULT_MECH_ID;
  return {
    seq: 0,
    turn: {
      side: "blue",
      round: 1,
      acted: false,
      pendingAnnouncement: null,
      pendingAction: null,
      pendingActionCanTriggerPassive: false,
    },
    players: {
      blue: createUnit("blue", BLUE_SPAWN, 0, blueMech),
      red: createUnit("red", RED_SPAWN, 1, redMech),
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
  return canIssueCommandByTurn(state, actor) && !state.turn.acted && state.turn.pendingAction === null;
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

function isStealthedUnit(unit: UnitState): boolean {
  return (
    (unit.mechId === "aya" && unit.effects.ayaStealthTurns > 0) ||
    (unit.mechId === "koishi" && unit.effects.koishiStealthTurns > 0)
  );
}

function isStealthedEnemyAt(state: GameState, actor: Side, coord: Coord): boolean {
  const enemy = state.players[oppositeSide(actor)];
  return coordsEqual(enemy.pos, coord) && isStealthedUnit(enemy);
}

function pickNearestCoord(anchor: Coord, candidates: Coord[]): Coord | null {
  let best: Coord | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dist = chebyshevDistance(anchor, candidate);
    if (!best || dist < bestDist) {
      best = candidate;
      bestDist = dist;
      continue;
    }
    if (dist > bestDist) {
      continue;
    }
    if (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x)) {
      best = candidate;
    }
  }
  return best ? { ...best } : null;
}

function findRangeMoveRedirectLanding(
  state: GameState,
  actor: Side,
  selectedTarget: Coord,
  range: number,
): Coord | null {
  const self = state.players[actor];
  const enemy = state.players[oppositeSide(actor)];
  const candidates: Coord[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const coord: Coord = { x, y };
      const distance = chebyshevDistance(self.pos, coord);
      if (distance <= 0 || distance > range) {
        continue;
      }
      if (isWallAliveAt(state, coord)) {
        continue;
      }
      if (coordsEqual(enemy.pos, coord)) {
        continue;
      }
      candidates.push(coord);
    }
  }
  return pickNearestCoord(selectedTarget, candidates);
}

function findAttackRedirectTarget(state: GameState, actor: Side, selectedTarget: Coord, range: number): Coord | null {
  const self = state.players[actor];
  const candidates: Coord[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const coord: Coord = { x, y };
      const distance = chebyshevDistance(self.pos, coord);
      if (distance <= 0 || distance > range) {
        continue;
      }
      if (!isAttackTargetAt(state, actor, coord)) {
        continue;
      }
      candidates.push(coord);
    }
  }
  return pickNearestCoord(selectedTarget, candidates);
}

function isAttackTargetAt(state: GameState, actor: Side, coord: Coord): boolean {
  if (isWallAliveAt(state, coord)) {
    return true;
  }
  const enemy = state.players[oppositeSide(actor)];
  if (isStealthedUnit(enemy)) {
    return false;
  }
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
  const ayaAttackVisionBonus = isAyaUnit(unit) && unit.effects.ayaNextAttackBuff ? 1 : 0;
  if (unit.effects.orbTurns > 0) {
    return Math.max(unit.stats.vision + ayaAttackVisionBonus, unit.effects.orbVisionRadius);
  }
  return unit.stats.vision + ayaAttackVisionBonus;
}

function getAttackRange(unit: UnitState): number {
  if (isAyaUnit(unit) && unit.effects.ayaNextAttackBuff) {
    return 2;
  }
  return 1;
}

function getAttackDamage(unit: UnitState): number {
  const bonus = isAyaUnit(unit) && unit.effects.ayaNextAttackBuff ? 1 : 0;
  return floorDamage(unit.stats.atk + bonus);
}

function getMoveRange(unit: UnitState): number {
  if (isAyaUnit(unit) && unit.effects.ayaNextMoveBuff) {
    return unit.stats.moveRange + 2;
  }
  return unit.stats.moveRange;
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
  sourceSide?: Side,
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
  const targetIsKoishi = isKoishiUnit(target);
  damageAnnouncements.push(`机体受伤：${getSideLabel(targetSide)}受到了${amount}点伤害`);
  if (targetIsKoishi) {
    target.effects.koishiStealthTurns = 0;
  }
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
  kind: "needle" | "amulet" | "wind",
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

function hasAyaSigilOnTarget(
  players: Record<Side, UnitState>,
  walls: Record<string, WallState>,
  actor: Side,
  target: Coord,
): boolean {
  const enemySide = oppositeSide(actor);
  if (coordsEqual(players[enemySide].pos, target)) {
    return players[enemySide].effects.ayaSigil;
  }
  return Boolean(walls[coordToKey(target)]?.ayaSigil);
}

function clearAyaSigilOnTarget(
  players: Record<Side, UnitState>,
  walls: Record<string, WallState>,
  actor: Side,
  target: Coord,
): void {
  const enemySide = oppositeSide(actor);
  if (coordsEqual(players[enemySide].pos, target)) {
    players[enemySide].effects.ayaSigil = false;
    return;
  }
  const key = coordToKey(target);
  if (walls[key]) {
    walls[key].ayaSigil = false;
  }
}

function collectRadiusOneNeighbors(center: Coord): Coord[] {
  const result: Coord[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const coord = {
        x: center.x + dx,
        y: center.y + dy,
      };
      if (!isCoordInBounds(coord)) {
        continue;
      }
      result.push(coord);
    }
  }
  return result;
}

function applyKoishiHeartAuraAtEnemyTurnStart(
  players: Record<Side, UnitState>,
  walls: Record<string, WallState>,
  enteringSide: Side,
  damageAnnouncements: string[],
): void {
  const koishiSide = oppositeSide(enteringSide);
  const koishi = players[koishiSide];
  if (!isKoishiUnit(koishi) || !koishi.effects.koishiHeartAuraActive) {
    return;
  }
  if (koishi.stats.spirit < 1) {
    koishi.effects.koishiHeartAuraActive = false;
    return;
  }
  koishi.stats.spirit -= 1;
  const neighbors = collectRadiusOneNeighbors(koishi.pos);
  const enemy = players[enteringSide];
  for (const coord of neighbors) {
    if (coordsEqual(enemy.pos, coord)) {
      applyEnemyDamage(players, enteringSide, 1, damageAnnouncements, koishiSide);
    }
    applyWallDamage(players, walls, koishiSide, coord, 1);
  }
}

function applyKoishiPolygraphAfterMove(
  state: GameState,
  actor: Side,
  movedOrthogonally: boolean,
  nextPlayers: Record<Side, UnitState>,
  damageAnnouncements: string[],
): void {
  if (!movedOrthogonally) {
    return;
  }
  if (state.turn.side !== actor) {
    return;
  }
  const koishiSide = oppositeSide(actor);
  if (!isKoishi(state, koishiSide)) {
    return;
  }
  if (state.players[koishiSide].effects.koishiPolygraphTurns <= 0) {
    return;
  }
  applyEnemyDamage(nextPlayers, actor, 1, damageAnnouncements, koishiSide);
}

function tryQueueAyaPassiveAttack(state: GameState, actor: Side, allowPassiveTrigger: boolean): GameState["turn"] {
  if (!allowPassiveTrigger || !isAya(state, actor)) {
    return markTurnActionEnded(state.turn);
  }
  const probeState: GameState = {
    ...state,
    turn: clearTurnPending({
      ...state.turn,
      acted: false,
    }),
  };
  if (getLegalAttackTargets(probeState, actor).length <= 0) {
    return markTurnActionEnded(state.turn);
  }
  return markTurnPendingAction(state.turn, "attack", false);
}

function tryQueueAyaMoveAfterAttack(
  state: GameState,
  actor: Side,
  allowPassiveTrigger: boolean,
  hitAyaSigil: boolean,
): GameState["turn"] {
  if (!isAya(state, actor)) {
    return markTurnActionEnded(state.turn);
  }
  const queueMove = hitAyaSigil || allowPassiveTrigger;
  if (!queueMove) {
    return markTurnActionEnded(state.turn);
  }
  const probeState: GameState = {
    ...state,
    turn: clearTurnPending({
      ...state.turn,
      acted: false,
    }),
  };
  if (getLegalMoveTargets(probeState, actor).length <= 0) {
    return markTurnActionEnded(state.turn);
  }
  return markTurnPendingAction(state.turn, "move", hitAyaSigil);
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

// 公告属于双方可见信息，写死并且不允许任何更改。{}代表变量。
function formatTurnAnnouncement(round: number, side: Side, text: string): string {
  return `${getPlayerIdBySide(side).toUpperCase()}回合${round}: ${text}`;
}

function appendTurnAnnouncements(
  base: string[],
  round: number,
  side: Side,
  additions: string[],
): string[] {
  const valid = additions.filter((item) => item.trim().length > 0);
  if (valid.length === 0) {
    return appendAnnouncements(base, []);
  }
  return appendAnnouncements(
    base,
    valid.map((text) => formatTurnAnnouncement(round, side, text)),
  );
}

function formatCoordDisplay(coord: Coord): string {
  return `${COL_LABELS[coord.x]}:${coord.y + 1}`;
}

export function getLegalMoveTargets(state: GameState, actor: Side): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (state.turn.pendingAction && state.turn.pendingAction !== "move") {
    return [];
  }

  const result: Coord[] = [];
  const self = state.players[actor];
  const enemy = state.players[oppositeSide(actor)];
  const range = getMoveRange(self);

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target: Coord = { x, y };
      if (!isCoordInBounds(target)) {
        continue;
      }
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > range) {
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
  if (!canIssuePrimaryAction(state, actor)) {
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
  return canIssuePrimaryAction(state, actor) && state.players[actor].stats.spirit >= 1;
}

export function getLegalAttackTargets(state: GameState, actor: Side): Coord[] {
  if (!canIssueAction(state, actor)) {
    return [];
  }
  if (state.turn.pendingAction && state.turn.pendingAction !== "attack") {
    return [];
  }

  const result: Coord[] = [];
  const self = state.players[actor];
  const range = getAttackRange(self);
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target: Coord = { x, y };
      if (!isCoordInBounds(target)) {
        continue;
      }
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > range) {
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
  if (!canIssuePrimaryAction(state, actor)) {
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
  if (!canUseRoleSkillByMech(state, actor, "role4")) {
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
      if (isWallAliveAt(state, target)) {
        continue;
      }
      result.push(target);
    }
  }
  return result;
}

export function getLegalKoishiRole1Targets(state: GameState, actor: Side): Coord[] {
  if (!canIssuePrimaryAction(state, actor)) {
    return [];
  }
  if (!isKoishi(state, actor)) {
    return [];
  }
  if (!state.players[actor].skills.role1) {
    return [];
  }
  if (!canUseRoleSkillByMech(state, actor, "role1")) {
    return [];
  }
  if (state.players[actor].stats.spirit < 1) {
    return [];
  }
  const self = state.players[actor];
  const result: Coord[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const target: Coord = { x, y };
      const distance = chebyshevDistance(self.pos, target);
      if (distance <= 0 || distance > 1) {
        continue;
      }
      if (isWallAliveAt(state, target)) {
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
  if (state.turn.pendingAction && state.turn.pendingAction !== "move") {
    return { ok: false, reason: "must resolve pending attack first" };
  }
  const allowPassiveTrigger = state.turn.pendingAction
    ? state.turn.pendingActionCanTriggerPassive
    : true;

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const legal = containsCoord(getLegalMoveTargets(state, actor), target);
  if (!legal) {
    return { ok: false, reason: "illegal move target" };
  }

  const self = state.players[actor];
  const movedOrthogonally = isOrthogonalStep(self.pos, target);
  const nextSpirit = movedOrthogonally
    ? Math.min(self.stats.maxSpirit, self.stats.spirit + 1)
    : self.stats.spirit;

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].pos = { ...target };
  nextPlayers[actor].stats.spirit = nextSpirit;
  const damageAnnouncements: string[] = [];
  applyKoishiPolygraphAfterMove(state, actor, movedOrthogonally, nextPlayers, damageAnnouncements);
  if (isAyaUnit(nextPlayers[actor])) {
    nextPlayers[actor].effects.ayaNextMoveBuff = false;
    activateAyaStealthIfReady(nextPlayers[actor]);
  }

  const actionStateForQueue: GameState = {
    ...state,
    players: nextPlayers,
    turn: clearTurnPending({
      ...state.turn,
      acted: false,
    }),
  };
  const nextTurn =
    nextPlayers[actor].stats.hp <= 0
      ? markTurnActionEnded(state.turn)
      : tryQueueAyaPassiveAttack(actionStateForQueue, actor, allowPassiveTrigger);
  const primaryAnnouncement = resolvePrimaryAnnouncement(
    state,
    actor,
    `${getSideLabel(actor)}进行了移动`,
    "move",
  );
  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
  });

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      primaryAnnouncement,
      ...damageAnnouncements,
    ]),
    turn: nextTurn,
    winner,
  };
  return { ok: true, state: nextState };
}

function applyBuild(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "build") {
    return { ok: false, reason: "invalid build command type" };
  }
  const actor = command.actor;
  if (!canIssuePrimaryAction(state, actor)) {
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
    ayaSigil: false,
  };

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      resolvePrimaryAnnouncement(state, actor, `${getSideLabel(actor)}进行了建造`, "build"),
    ]),
    turn: markTurnActionEnded(state.turn),
  };
  return { ok: true, state: nextState };
}

function applyScout(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "scout") {
    return { ok: false, reason: "invalid scout command type" };
  }
  const actor = command.actor;
  if (!canIssuePrimaryAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  const self = state.players[actor];
  if (self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }

  const enemy = state.players[oppositeSide(actor)];
  const scoutResult = isKoishiUnit(enemy) || isGrass(enemy.pos)
    ? "/无法被侦察"
    : `${getSideLabel(oppositeSide(actor))}的坐标为${formatCoordDisplay(enemy.pos)}。`;

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= 1;

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
      resolvePrimaryAnnouncement(state, actor, `${getSideLabel(actor)}进行了侦察，${scoutResult}`, "scout"),
    ]),
    turn: markTurnActionEnded(state.turn),
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
  if (state.turn.pendingAction && state.turn.pendingAction !== "attack") {
    return { ok: false, reason: "must resolve pending move first" };
  }
  const allowPassiveTrigger = state.turn.pendingAction
    ? state.turn.pendingActionCanTriggerPassive
    : true;

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }
  const self = state.players[actor];
  const attackRange = getAttackRange(self);
  if (chebyshevDistance(self.pos, target) > attackRange || coordsEqual(self.pos, target)) {
    return { ok: false, reason: "attack target out of range" };
  }
  let resolvedTarget: Coord = { ...target };
  if (isStealthedEnemyAt(state, actor, target)) {
    const redirectedTarget = findAttackRedirectTarget(state, actor, target, attackRange);
    if (!redirectedTarget) {
      return { ok: false, reason: "no redirect attack target" };
    }
    resolvedTarget = redirectedTarget;
  }
  if (!isAttackTargetAt(state, actor, resolvedTarget)) {
    return { ok: false, reason: "no valid target in tile" };
  }

  const damage = getAttackDamage(self);
  const enemySide = oppositeSide(actor);
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  const damageAnnouncements: string[] = [];
  const attackerIsKoishi = isKoishi(state, actor);
  const canTriggerKoishiPhilosophy =
    attackerIsKoishi &&
    nextPlayers[actor].effects.koishiPhilosophyActive &&
    coordsEqual(nextPlayers[enemySide].pos, resolvedTarget);
  const koishiExtraDamage = canTriggerKoishiPhilosophy
    ? Math.max(0, getBaseHpByMech(nextPlayers[enemySide].mechId) - nextPlayers[enemySide].stats.hp)
    : 0;
  if (attackerIsKoishi) {
    nextPlayers[actor].effects.koishiStealthTurns = 0;
  }
  const hitAyaSigil =
    isAya(state, actor) && hasAyaSigilOnTarget(state.players, state.walls, actor, resolvedTarget);
  if (hitAyaSigil) {
    clearAyaSigilOnTarget(nextPlayers, nextWalls, actor, resolvedTarget);
  }

  if (coordsEqual(nextPlayers[enemySide].pos, resolvedTarget)) {
    applyEnemyDamage(nextPlayers, enemySide, damage, damageAnnouncements, actor);
  }
  if (canTriggerKoishiPhilosophy) {
    nextPlayers[actor].effects.koishiPhilosophyActive = false;
    nextPlayers[actor].effects.koishiPhilosophyHits = 0;
    applyEnemyDamage(nextPlayers, enemySide, koishiExtraDamage, damageAnnouncements, actor);
  }
  applyWallDamage(nextPlayers, nextWalls, actor, resolvedTarget, damage);
  if (isAyaUnit(nextPlayers[actor])) {
    nextPlayers[actor].effects.ayaNextAttackBuff = false;
    activateAyaStealthIfReady(nextPlayers[actor]);
  }

  const actionStateForQueue: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    turn: clearTurnPending({
      ...state.turn,
      acted: false,
    }),
  };
  const nextTurn = tryQueueAyaMoveAfterAttack(actionStateForQueue, actor, allowPassiveTrigger, hitAyaSigil);

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
      resolvePrimaryAnnouncement(state, actor, `${getSideLabel(actor)}进行了普通攻击`, "attack"),
      ...(canTriggerKoishiPhilosophy ? ["今、貴方の後ろに居るの"] : []),
      ...damageAnnouncements,
    ]),
    turn: nextTurn,
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
  if (state.turn.pendingAction !== null) {
    return { ok: false, reason: "cannot unlock during pending action" };
  }

  const self = state.players[actor];
  if (!canUseRoleSkillByMech(state, actor, command.skill)) {
    return { ok: false, reason: "role skill not implemented for current mech" };
  }
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
  if (!canIssuePrimaryAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!canUseRoleSkillByMech(state, actor, "role1")) {
    return { ok: false, reason: "role1 not implemented for current mech" };
  }
  if (!self.skills.role1) {
    return { ok: false, reason: "skill role1 not unlocked" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }

  if (isKoishi(state, actor)) {
    if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
      return { ok: false, reason: "invalid spirit spend" };
    }
    if (self.stats.spirit < command.spirit) {
      return { ok: false, reason: "not enough spirit" };
    }
    const legal = containsCoord(getLegalKoishiRole1Targets(state, actor), target);
    if (!legal) {
      return { ok: false, reason: "illegal koishi role1 target" };
    }
    const landing: Coord = { ...target };
    const nextPlayers = clonePlayers(state.players);
    nextPlayers[actor].stats.spirit -= command.spirit;
    nextPlayers[actor].pos = { ...landing };
    nextPlayers[actor].effects.koishiStealthTurns = command.spirit;
    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        turn: markTurnActionEnded(state.turn),
      },
    };
  }

  const ray = buildRayPath(self.pos, target);
  if (!ray || ray.cells.length === 0) {
    return { ok: false, reason: "invalid needle direction" };
  }

  if (isAya(state, actor)) {
    if (!Number.isInteger(command.spirit) || command.spirit !== 2) {
      return { ok: false, reason: "aya role1 spirit must be 2" };
    }
    if (self.stats.spirit < 2) {
      return { ok: false, reason: "not enough spirit" };
    }

    const enemySide = oppositeSide(actor);
    const nextPlayers = clonePlayers(state.players);
    const nextWalls = cloneWalls(state.walls);
    const damageAnnouncements: string[] = [];
    const projectiles: ProjectileEffect[] = [];

    for (let index = 0; index < 2; index += 1) {
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

        let hitCoord: Coord | null = null;
        let hitType: "wall" | "enemy" | null = null;
        for (const hit of group) {
          if (isWallAliveInMap(nextWalls, hit.coord)) {
            hitCoord = hit.coord;
            hitType = "wall";
            break;
          }
        }
        if (!hitType) {
          for (const hit of group) {
            if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
              hitCoord = hit.coord;
              hitType = "enemy";
              break;
            }
          }
        }

        if (!hitCoord || !hitType) {
          continue;
        }

        if (hitType === "wall") {
          const damaged = applyWallDamage(nextPlayers, nextWalls, actor, hitCoord, 1);
          if (damaged) {
            const key = coordToKey(hitCoord);
            if (nextWalls[key]?.alive) {
              nextWalls[key].ayaSigil = true;
            }
          }
        } else {
          const damaged = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements, actor);
          if (damaged && nextPlayers[enemySide].stats.hp > 0) {
            nextPlayers[enemySide].effects.ayaSigil = true;
          }
        }

        endT = Math.max(groupEnterT + RAY_EPSILON, traveledExitT);
        break;
      }

      if (traveledExitT > RAY_EPSILON && endT === ray.maxT) {
        endT = traveledExitT;
      }

      projectiles.push(
        buildProjectileEffect(
          "wind",
          actor,
          nextPlayers[actor].pos,
          traveled,
          index * NEEDLE_INTERVAL_MS,
          getRayPoint(ray, endT),
        ),
      );
    }

    nextPlayers[actor].stats.spirit -= 2;

    const winner = getWinnerFromPlayers({
      ...state,
      players: nextPlayers,
      walls: nextWalls,
    });

    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        walls: nextWalls,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          resolvePrimaryAnnouncement(state, actor, "文发射了旋风", "aya-role1"),
          ...damageAnnouncements,
        ]),
        turn: markTurnActionEnded(state.turn),
        winner,
      },
      effects: {
        projectiles,
      },
    };
  }

  if (!Number.isInteger(command.spirit) || command.spirit <= 0) {
    return { ok: false, reason: "invalid spirit spend" };
  }
  if (self.stats.spirit < command.spirit) {
    return { ok: false, reason: "not enough spirit" };
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
          groupHit = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements, actor) || groupHit;
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
      "灵梦发射了封魔针",
      ...damageAnnouncements,
    ]),
    turn: markTurnActionEnded(state.turn),
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
  const self = state.players[actor];
  const koishiRole2Toggle = isKoishi(state, actor);
  if (koishiRole2Toggle) {
    if (!canIssueCommandByTurn(state, actor)) {
      return { ok: false, reason: "cannot act now" };
    }
  } else if (!canIssuePrimaryAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }
  if (!canUseRoleSkillByMech(state, actor, "role2")) {
    return { ok: false, reason: "role2 not implemented for current mech" };
  }
  if (!self.skills.role2) {
    return { ok: false, reason: "skill role2 not unlocked" };
  }
  if (!Number.isInteger(command.spirit) || command.spirit !== 1) {
    return { ok: false, reason: "amulet spirit must be 1" };
  }
  if (!koishiRole2Toggle && self.stats.spirit < 1) {
    return { ok: false, reason: "not enough spirit" };
  }

  const target = keyToCoord(command.to);
  if (!target) {
    return { ok: false, reason: "invalid target coordinate" };
  }

  if (koishiRole2Toggle) {
    if (!coordsEqual(target, self.pos)) {
      return { ok: false, reason: "koishi role2 must target self tile" };
    }
    const nextPlayers = clonePlayers(state.players);
    nextPlayers[actor].effects.koishiHeartAuraActive = !nextPlayers[actor].effects.koishiHeartAuraActive;
    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
      },
    };
  }

  if (isAya(state, actor)) {
    const legalMove = containsCoord(getLegalMoveTargets(state, actor), target);
    const legalAttack = containsCoord(getLegalAttackTargets(state, actor), target);
    if (!legalMove && !legalAttack) {
      return { ok: false, reason: "illegal aya role2 target" };
    }

    const nextPlayers = clonePlayers(state.players);
    const nextWalls = cloneWalls(state.walls);
    const damageAnnouncements: string[] = [];
    nextPlayers[actor].stats.spirit -= 1;
    const primaryAnnouncement = resolvePrimaryAnnouncement(state, actor, "文进行了强化", "aya-role2");

    if (legalMove) {
      const beforeMove = { ...nextPlayers[actor].pos };
      nextPlayers[actor].effects.ayaNextAttackBuff = true;
      nextPlayers[actor].pos = { ...target };
      if (isOrthogonalStep(beforeMove, target)) {
        nextPlayers[actor].stats.spirit = Math.min(
          nextPlayers[actor].stats.maxSpirit,
          nextPlayers[actor].stats.spirit + 1,
        );
      }
      nextPlayers[actor].effects.ayaNextMoveBuff = false;
      activateAyaStealthIfReady(nextPlayers[actor]);

      const queueState: GameState = {
        ...state,
        players: nextPlayers,
        walls: nextWalls,
        turn: clearTurnPending({
          ...state.turn,
          acted: false,
        }),
      };
      const nextTurn = tryQueueAyaPassiveAttack(queueState, actor, true);
      return {
        ok: true,
        state: {
          ...state,
          players: nextPlayers,
          walls: nextWalls,
          announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [primaryAnnouncement]),
          turn: nextTurn,
        },
      };
    }

    const enemySide = oppositeSide(actor);
    const attackerBefore = nextPlayers[actor];
    nextPlayers[actor].effects.ayaNextMoveBuff = true;
    const damage = getAttackDamage(attackerBefore);
    const hitAyaSigil = hasAyaSigilOnTarget(state.players, state.walls, actor, target);
    if (hitAyaSigil) {
      clearAyaSigilOnTarget(nextPlayers, nextWalls, actor, target);
    }
    if (coordsEqual(nextPlayers[enemySide].pos, target)) {
      applyEnemyDamage(nextPlayers, enemySide, damage, damageAnnouncements, actor);
    }
    applyWallDamage(nextPlayers, nextWalls, actor, target, damage);
    nextPlayers[actor].effects.ayaNextAttackBuff = false;
    activateAyaStealthIfReady(nextPlayers[actor]);

    const winner = getWinnerFromPlayers({
      ...state,
      players: nextPlayers,
      walls: nextWalls,
    });
    const queueState: GameState = {
      ...state,
      players: nextPlayers,
      walls: nextWalls,
      turn: clearTurnPending({
        ...state.turn,
        acted: false,
      }),
    };
    const nextTurn = tryQueueAyaMoveAfterAttack(queueState, actor, true, hitAyaSigil);

    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        walls: nextWalls,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          primaryAnnouncement,
          ...damageAnnouncements,
        ]),
        turn: nextTurn,
        winner,
      },
    };
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
      hitEnemy = applyEnemyDamage(nextPlayers, enemySide, 1, damageAnnouncements, actor) || hitEnemy;
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
      "灵梦发射了符札",
      ...damageAnnouncements,
    ]),
    turn: markTurnActionEnded(state.turn),
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
  if (!canIssuePrimaryAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!canUseRoleSkillByMech(state, actor, "role3")) {
    return { ok: false, reason: "role3 not implemented for current mech" };
  }
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
  if (isAya(state, actor)) {
    if (command.spirit !== 1) {
      return { ok: false, reason: "aya role3 spirit must be 1" };
    }
    nextPlayers[actor].stats.spirit -= 1;
    nextPlayers[actor].effects.ayaStealthReady = true;
    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          resolvePrimaryAnnouncement(state, actor, "文准备了隐身", "aya-role3", true),
        ]),
        turn: markTurnActionEnded(state.turn),
      },
    };
  }

  if (isKoishi(state, actor)) {
    nextPlayers[actor].stats.spirit -= command.spirit;
    nextPlayers[actor].effects.koishiPolygraphTurns = command.spirit;
    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        turn: markTurnActionEnded(state.turn),
      },
    };
  }

  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].effects.orbVisionRadius = command.spirit;
  nextPlayers[actor].effects.orbTurns = command.spirit;

  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `灵梦获得了半径为${command.spirit}的视野`,
      ]),
      turn: markTurnActionEnded(state.turn),
    },
  };
}

function applyBlink(state: GameState, command: Command): ApplyOutcome {
  if (command.type !== "blink") {
    return { ok: false, reason: "invalid blink command type" };
  }
  const actor = command.actor;
  if (!canIssuePrimaryAction(state, actor)) {
    return { ok: false, reason: "cannot act now" };
  }

  const self = state.players[actor];
  if (!canUseRoleSkillByMech(state, actor, "role4")) {
    return { ok: false, reason: "role4 not implemented for current mech" };
  }
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
  if (isKoishi(state, actor)) {
    if (command.spirit !== KOISHI_ROLE4_COST) {
      return { ok: false, reason: "koishi role4 spirit must be 5" };
    }
    if (!coordsEqual(target, self.pos)) {
      return { ok: false, reason: "koishi role4 must target self tile" };
    }
    if (self.effects.koishiPhilosophyActive) {
      return { ok: false, reason: "koishi role4 already active" };
    }
    const nextPlayers = clonePlayers(state.players);
    nextPlayers[actor].stats.spirit -= KOISHI_ROLE4_COST;
    nextPlayers[actor].effects.koishiPhilosophyActive = true;
    nextPlayers[actor].effects.koishiPhilosophyHits = 0;
    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        turn: markTurnActionEnded(state.turn),
      },
    };
  }
  const legal = containsCoord(getLegalBlinkTargets(state, actor, command.spirit), target);
  if (!legal) {
    return { ok: false, reason: "illegal blink target" };
  }
  const landing: Coord = { ...target };

  if (isAya(state, actor)) {
    const nextPlayers = clonePlayers(state.players);
    const nextWalls = cloneWalls(state.walls);
    const damageAnnouncements: string[] = [];
    const damage = floorDamage(self.stats.atk);
    const enemySide = oppositeSide(actor);
    let hitEnemy = false;

    const ray = buildRayPath(self.pos, landing);
    if (ray) {
      for (const hit of ray.cells) {
        if (coordsEqual(hit.coord, landing)) {
          break;
        }
        if (applyWallDamage(nextPlayers, nextWalls, actor, hit.coord, damage)) {
          nextWalls[coordToKey(hit.coord)].ayaSigil = false;
        }
        if (coordsEqual(nextPlayers[enemySide].pos, hit.coord)) {
          hitEnemy = applyEnemyDamage(nextPlayers, enemySide, damage, damageAnnouncements, actor) || hitEnemy;
        }
      }
    }

    const spiritAfter = nextPlayers[actor].stats.spirit - command.spirit + (hitEnemy ? command.spirit : 0);
    nextPlayers[actor].stats.spirit = Math.max(
      0,
      Math.min(nextPlayers[actor].stats.maxSpirit, spiritAfter),
    );
    nextPlayers[actor].pos = { ...landing };

    const winner = getWinnerFromPlayers({
      ...state,
      players: nextPlayers,
      walls: nextWalls,
    });

    return {
      ok: true,
      state: {
        ...state,
        players: nextPlayers,
        walls: nextWalls,
        announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
          resolvePrimaryAnnouncement(state, actor, "文进行了位移", "aya-role4"),
          ...damageAnnouncements,
        ]),
        turn: markTurnActionEnded(state.turn),
        winner,
      },
    };
  }

  const nextPlayers = clonePlayers(state.players);
  nextPlayers[actor].stats.spirit -= command.spirit;
  nextPlayers[actor].pos = { ...landing };

  return {
    ok: true,
    state: {
      ...state,
      players: nextPlayers,
      announcements: appendTurnAnnouncements(state.announcements, state.turn.round, actor, [
        `灵梦闪现到了半径为${command.spirit}内的一格`,
      ]),
      turn: markTurnActionEnded(state.turn),
    },
  };
}

function decrementTimedEffectsWhenTurnStarts(players: Record<Side, UnitState>, enteringSide: Side): void {
  const effect = players[enteringSide].effects;
  if (effect.orbTurns <= 0) {
    // continue
  } else {
    effect.orbTurns = Math.max(0, effect.orbTurns - 1);
    if (effect.orbTurns === 0) {
      effect.orbVisionRadius = 0;
    }
  }
  if (effect.ayaStealthTurns > 0) {
    effect.ayaStealthTurns = Math.max(0, effect.ayaStealthTurns - 1);
  }
  if (effect.koishiStealthTurns > 0) {
    effect.koishiStealthTurns = Math.max(0, effect.koishiStealthTurns - 1);
    if (effect.koishiStealthTurns === 0 && isGrass(players[enteringSide].pos)) {
      effect.koishiStealthTurns = 1;
    }
  }
  if (effect.koishiPolygraphTurns > 0) {
    effect.koishiPolygraphTurns = Math.max(0, effect.koishiPolygraphTurns - 1);
  }
}

function advanceTurnState(state: GameState, actor: Side): GameState {
  const nextSide = oppositeSide(actor);
  const nextRound = actor === "red" ? state.turn.round + 1 : state.turn.round;
  const nextPlayers = clonePlayers(state.players);
  const nextWalls = cloneWalls(state.walls);
  decrementTimedEffectsWhenTurnStarts(nextPlayers, nextSide);
  const turnStartDamageAnnouncements: string[] = [];
  applyKoishiHeartAuraAtEnemyTurnStart(nextPlayers, nextWalls, nextSide, turnStartDamageAnnouncements);
  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls,
  });
  return {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements: appendTurnAnnouncements(state.announcements, nextRound, nextSide, turnStartDamageAnnouncements),
    winner,
    turn: {
      side: nextSide,
      round: nextRound,
      acted: false,
      pendingAnnouncement: null,
      pendingAction: null,
      pendingActionCanTriggerPassive: false,
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
          resolvePrimaryAnnouncement(state, actor, `${getSideLabel(actor)}选择了空过`, "endturn"),
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
  if (!applied.state.turn.acted) {
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
  const enemyUnit = state.players[enemySide];
  const enemyPos = enemyUnit.pos;
  const enemyStealthed =
    (enemyUnit.mechId === "aya" && enemyUnit.effects.ayaStealthTurns > 0) ||
    (enemyUnit.mechId === "koishi" && enemyUnit.effects.koishiStealthTurns > 0);
  const enemyVisible = !enemyStealthed && isVisibleFrom(state, side, enemyPos);

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
