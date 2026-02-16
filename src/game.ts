import {
  ApplyOutcome,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COL_LABELS,
  Command,
  CommandEnvelope,
  Coord,
  GameState,
  PerspectiveCell,
  PerspectiveState,
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
      hp: 20,
      spirit: initialSpirit,
      maxSpirit: 25,
      atk: 1,
      vision: 1,
      moveRange: 1,
      gold: 100,
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
  return canIssueCommandByTurn(state, actor) && state.turn.acted;
}

function containsCoord(list: Coord[], target: Coord): boolean {
  return list.some((item) => coordsEqual(item, target));
}

function isWallAliveAt(state: GameState, coord: Coord): boolean {
  return Boolean(state.walls[coordToKey(coord)]?.alive);
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

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [actor]: {
        ...self,
        pos: { ...target },
        stats: {
          ...self.stats,
          spirit: nextSpirit,
        },
      },
    },
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: `${getSideLabel(actor)}\u8fdb\u884c\u4e86\u79fb\u52a8`,
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

  const self = state.players[actor];
  const wallKey = coordToKey(target);
  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [actor]: {
        ...self,
        stats: {
          ...self.stats,
          spirit: self.stats.spirit - command.spirit,
        },
      },
    },
    walls: {
      ...state.walls,
      [wallKey]: {
        hp: command.spirit,
        maxHp: command.spirit,
        alive: true,
      },
    },
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: `${getSideLabel(actor)}\u8fdb\u884c\u4e86\u5efa\u9020`,
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
    ? "\u65e0\u6cd5\u88ab\u4fa6\u5bdf"
    : `\u5750\u6807\u4e3a(${enemy.pos.x + 1},${enemy.pos.y + 1})`;

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [actor]: {
        ...self,
        stats: {
          ...self.stats,
          spirit: self.stats.spirit - 1,
        },
      },
    },
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: `${getSideLabel(actor)}\u8fdb\u884c\u4e86\u4fa6\u5bdf\uff0c${scoutResult}`,
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
  const enemy = state.players[enemySide];
  const nextPlayers: Record<Side, UnitState> = {
    ...state.players,
    [actor]: {
      ...self,
      stats: { ...self.stats },
    },
    [enemySide]: {
      ...enemy,
      stats: { ...enemy.stats },
    },
  };
  const nextWalls: Record<string, WallState> = { ...state.walls };
  const damageAnnouncements: string[] = [];

  if (coordsEqual(enemy.pos, target) && damage > 0) {
    const hpAfter = Math.max(0, enemy.stats.hp - damage);
    nextPlayers[enemySide].stats.hp = hpAfter;
    damageAnnouncements.push(`${getSideLabel(enemySide)}\u53d7\u5230\u4e86${damage}\u70b9\u4f24\u5bb3`);
  }

  let wallReward = 0;
  const wallKey = coordToKey(target);
  const wall = nextWalls[wallKey];
  if (wall?.alive && damage > 0) {
    const hpAfter = wall.hp - damage;
    if (hpAfter <= 0) {
      wallReward = 4 * wall.maxHp;
      nextWalls[wallKey] = {
        ...wall,
        hp: 0,
        alive: false,
      };
    } else {
      nextWalls[wallKey] = {
        ...wall,
        hp: hpAfter,
      };
    }
  }

  if (wallReward > 0) {
    nextPlayers[actor].stats.gold += wallReward;
  }

  const winner = getWinnerFromPlayers({
    ...state,
    players: nextPlayers,
    walls: nextWalls,
  });

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    walls: nextWalls,
    announcements:
      damageAnnouncements.length > 0
        ? [...state.announcements, ...damageAnnouncements]
        : [...state.announcements],
    turn: {
      ...state.turn,
      acted: true,
      pendingAnnouncement: `${getSideLabel(actor)}\u8fdb\u884c\u4e86\u666e\u901a\u653b\u51fb\u3002`,
    },
    winner,
  };
  return { ok: true, state: nextState };
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

  const nextSide = oppositeSide(actor);
  const nextRound = actor === "red" ? state.turn.round + 1 : state.turn.round;
  const announcement = state.turn.pendingAnnouncement;

  const nextState: GameState = {
    ...state,
    announcements: announcement ? [...state.announcements, announcement] : [...state.announcements],
    turn: {
      side: nextSide,
      round: nextRound,
      acted: false,
      pendingAnnouncement: null,
    },
  };
  return { ok: true, state: nextState };
}

function applyCommand(state: GameState, command: Command): ApplyOutcome {
  if (state.winner) {
    return { ok: false, reason: "game has ended" };
  }
  switch (command.type) {
    case "move":
      return applyMove(state, command);
    case "build":
      return applyBuild(state, command);
    case "scout":
      return applyScout(state, command);
    case "attack":
      return applyAttack(state, command);
    case "endTurn":
      return applyEndTurn(state, command);
    default:
      return { ok: false, reason: "unsupported command" };
  }
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
  };
}

function isVisibleFrom(state: GameState, observerSide: Side, coord: Coord): boolean {
  const self = state.players[observerSide];
  if (chebyshevDistance(self.pos, coord) > self.stats.vision) {
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
  return `(${coord.x + 1},${coord.y + 1})`;
}

export function formatCoordAlphaNumeric(coord: Coord): string {
  return `${COL_LABELS[coord.x]}${coord.y + 1}`;
}

