export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 9;
export const COL_LABELS = "ABCDEFGHIJKL".split("");

export type Side = "blue" | "red";
export type PlayerId = "p1" | "p2";
export type MechId = "reimu" | "marisa" | "koishi" | "aya";
export type BpBanOptionId = MechId | "none";
export type BpActionType = "ban" | "pick";
export type TerrainType = "ground" | "grass" | "spawnBlue" | "spawnRed";
export type SkillId =
  | "move"
  | "build"
  | "scout"
  | "attack"
  | "role1"
  | "role2"
  | "role3"
  | "role4";
export type RoleSkillId = "role1" | "role2" | "role3" | "role4";

export interface Coord {
  x: number;
  y: number;
}

export interface UnitStats {
  hp: number;
  spirit: number;
  maxSpirit: number;
  atk: number;
  vision: number;
  moveRange: number;
  gold: number;
}

export interface SkillUnlockState {
  role1: boolean;
  role2: boolean;
  role3: boolean;
  role4: boolean;
}

export interface UnitEffects {
  orbVisionRadius: number;
  orbTurns: number;
}

export interface UnitState {
  id: PlayerId;
  side: Side;
  mechId: MechId;
  pos: Coord;
  stats: UnitStats;
  skills: SkillUnlockState;
  effects: UnitEffects;
}

export interface WallState {
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface TurnState {
  side: Side;
  round: number;
  acted: boolean;
  pendingAnnouncement: string | null;
}

export interface GameState {
  seq: number;
  turn: TurnState;
  players: Record<Side, UnitState>;
  walls: Record<string, WallState>;
  announcements: string[];
  winner: Side | null;
}

export interface PerspectiveCell {
  coord: Coord;
  terrain: TerrainType;
  visible: boolean;
  hasWall: boolean;
  wallHp: number | null;
}

export interface PerspectiveState {
  side: Side;
  cells: PerspectiveCell[];
  pieces: Partial<Record<Side, Coord>>;
}

export interface MoveCommand {
  type: "move";
  actor: Side;
  to: string;
}

export interface BuildCommand {
  type: "build";
  actor: Side;
  to: string;
  spirit: number;
}

export interface ScoutCommand {
  type: "scout";
  actor: Side;
}

export interface AttackCommand {
  type: "attack";
  actor: Side;
  to: string;
}

export interface EndTurnCommand {
  type: "endTurn";
  actor: Side;
}

export interface UnlockSkillCommand {
  type: "unlockSkill";
  actor: Side;
  skill: RoleSkillId;
}

export interface NeedleCommand {
  type: "needle";
  actor: Side;
  to: string;
  spirit: number;
}

export interface AmuletCommand {
  type: "amulet";
  actor: Side;
  to: string;
  spirit: number;
}

export interface OrbCommand {
  type: "orb";
  actor: Side;
  spirit: number;
}

export interface BlinkCommand {
  type: "blink";
  actor: Side;
  to: string;
  spirit: number;
}

export type Command =
  | MoveCommand
  | BuildCommand
  | ScoutCommand
  | AttackCommand
  | EndTurnCommand
  | UnlockSkillCommand
  | NeedleCommand
  | AmuletCommand
  | OrbCommand
  | BlinkCommand;

export interface ProjectileEffect {
  kind: "needle" | "amulet";
  actor: Side;
  origin: string;
  path: string[];
  rayEnd?: Coord;
  delayMs: number;
}

export interface CommandEffects {
  projectiles?: ProjectileEffect[];
}

export interface CommandEnvelope {
  kind: "command";
  seq: number;
  command: Command;
}

export interface DebugHashMessage {
  kind: "debugHash";
  seq: number;
  hash: string;
}

export interface BpActionMessage {
  kind: "bpAction";
  actor: Side;
  action: BpActionType;
  mechId: BpBanOptionId;
}

export type NetMessage = CommandEnvelope | DebugHashMessage | BpActionMessage;

export interface ApplyResult {
  ok: true;
  state: GameState;
  effects?: CommandEffects;
}

export interface ApplyError {
  ok: false;
  reason: string;
}

export type ApplyOutcome = ApplyResult | ApplyError;

export function getSideLabel(side: Side): string {
  return side === "blue" ? "\u84dd\u65b9" : "\u7ea2\u65b9";
}

export function getPlayerIdBySide(side: Side): PlayerId {
  return side === "blue" ? "p1" : "p2";
}

export function isCoordInBounds(coord: Coord): boolean {
  return coord.x >= 0 && coord.x < BOARD_WIDTH && coord.y >= 0 && coord.y < BOARD_HEIGHT;
}

export function chebyshevDistance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isOrthogonalStep(a: Coord, b: Coord): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function coordToKey(coord: Coord): string {
  return `${COL_LABELS[coord.x]}${coord.y + 1}`;
}

export function coordToDisplayKey(coord: Coord): string {
  return `${COL_LABELS[coord.x]}:${coord.y + 1}`;
}

export function keyToCoord(key: string): Coord | null {
  if (key.length < 2) {
    return null;
  }
  const colRaw = key[0]?.toUpperCase();
  const yRaw = Number(key.slice(1));
  const x = COL_LABELS.indexOf(colRaw);
  const y = yRaw - 1;
  if (x < 0 || Number.isNaN(yRaw)) {
    return null;
  }
  const coord = { x, y };
  return isCoordInBounds(coord) ? coord : null;
}

export function oppositeSide(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}

export function isRoleSkillId(skill: SkillId): skill is RoleSkillId {
  return skill === "role1" || skill === "role2" || skill === "role3" || skill === "role4";
}
