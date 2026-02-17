import {
  canEndTurn,
  canUseScout,
  createAmuletCommand,
  createAttackCommand,
  createBlinkCommand,
  createBuildCommand,
  createEndTurnCommand,
  createMoveCommand,
  createNeedleCommand,
  createOrbCommand,
  createScoutCommand,
  getLegalAttackTargets,
  getLegalBlinkTargets,
  getLegalBuildTargets,
  getLegalMoveTargets,
  getQuickCastTargets,
} from "./game";
import { Command, Coord, GameState, Side, SkillId, coordsEqual, isRoleSkillId } from "./protocol";

export interface InputState {
  activeSkill: SkillId | null;
  quickCast: boolean;
  spiritSpend: number;
}

export interface InputContext {
  game: GameState;
  localSide: Side;
  connected: boolean;
  ballisticPending: boolean;
}

export interface InputResult {
  next: InputState;
  command?: Command;
}

export interface HighlightSet {
  moveHighlights: Coord[];
  attackHighlights: Coord[];
}

export interface SpiritSelectorView {
  visible: boolean;
  value: number;
  min: number;
  max: number;
}

export type SkillAvailability = Record<SkillId, boolean>;

function containsCoord(list: Coord[], target: Coord): boolean {
  return list.some((item) => coordsEqual(item, target));
}

function canAct(ctx: InputContext): boolean {
  return ctx.connected && !ctx.game.winner && ctx.game.turn.side === ctx.localSide && !ctx.game.turn.acted;
}

function localUnit(ctx: InputContext) {
  return ctx.game.players[ctx.localSide];
}

function getSpiritSpendBounds(skill: SkillId | null, ctx: InputContext): { min: number; max: number } {
  if (skill !== "build" && skill !== "role1" && skill !== "role3" && skill !== "role4") {
    return { min: 0, max: 0 };
  }
  const max = Math.max(0, Math.floor(localUnit(ctx).stats.spirit));
  return { min: max > 0 ? 1 : 0, max };
}

function hasAnyBuildTarget(ctx: InputContext): boolean {
  const bounds = getSpiritSpendBounds("build", ctx);
  if (bounds.max < 1) {
    return false;
  }
  for (let spend = bounds.min; spend <= bounds.max; spend += 1) {
    if (getLegalBuildTargets(ctx.game, ctx.localSide, spend).length > 0) {
      return true;
    }
  }
  return false;
}

function hasAnyBlinkTarget(ctx: InputContext): boolean {
  const bounds = getSpiritSpendBounds("role4", ctx);
  if (bounds.max < 1) {
    return false;
  }
  for (let spend = bounds.min; spend <= bounds.max; spend += 1) {
    if (getLegalBlinkTargets(ctx.game, ctx.localSide, spend).length > 0) {
      return true;
    }
  }
  return false;
}

function isVariableSpiritSkill(skill: SkillId | null): boolean {
  return skill === "build" || skill === "role1" || skill === "role3" || skill === "role4";
}

export function createInitialInputState(): InputState {
  return {
    activeSkill: null,
    quickCast: false,
    spiritSpend: 1,
  };
}

export function getSkillAvailability(ctx: InputContext): SkillAvailability {
  const self = localUnit(ctx);
  const noAction: SkillAvailability = {
    move: false,
    build: false,
    scout: false,
    attack: false,
    role1: false,
    role2: false,
    role3: false,
    role4: false,
  };

  if (!canAct(ctx)) {
    return noAction;
  }

  return {
    move: getLegalMoveTargets(ctx.game, ctx.localSide).length > 0,
    build: hasAnyBuildTarget(ctx),
    scout: canUseScout(ctx.game, ctx.localSide),
    attack: getLegalAttackTargets(ctx.game, ctx.localSide).length > 0,
    role1: self.skills.role1 && self.stats.spirit >= 1,
    role2: self.skills.role2 && self.stats.spirit >= 1,
    role3: self.skills.role3 && self.stats.spirit >= 1,
    role4: self.skills.role4 && hasAnyBlinkTarget(ctx),
  };
}

export function onSkillClick(state: InputState, skill: SkillId, ctx: InputContext): InputResult {
  const nextState: InputState = {
    ...state,
    quickCast: false,
  };

  if (state.activeSkill === skill) {
    return {
      next: {
        ...nextState,
        activeSkill: null,
      },
    };
  }

  const availability = getSkillAvailability(ctx);
  if (!availability[skill]) {
    return { next: { ...nextState, activeSkill: null } };
  }

  if (isRoleSkillId(skill) && !localUnit(ctx).skills[skill]) {
    return { next: { ...nextState, activeSkill: null } };
  }

  const bounds = getSpiritSpendBounds(skill, ctx);
  const clampedSpend = bounds.max > 0 ? Math.max(bounds.min, Math.min(bounds.max, nextState.spiritSpend)) : 1;

  return {
    next: {
      ...nextState,
      activeSkill: skill,
      spiritSpend: clampedSpend,
    },
  };
}

export function onAdjustSpiritSpend(state: InputState, delta: number, ctx: InputContext): InputResult {
  if (!isVariableSpiritSkill(state.activeSkill)) {
    return { next: { ...state } };
  }
  const bounds = getSpiritSpendBounds(state.activeSkill, ctx);
  if (bounds.max < 1) {
    return {
      next: {
        ...state,
        spiritSpend: 1,
      },
    };
  }
  const nextSpend = Math.max(bounds.min, Math.min(bounds.max, state.spiritSpend + delta));
  return {
    next: {
      ...state,
      spiritSpend: nextSpend,
    },
  };
}

export function onBoardClick(state: InputState, coord: Coord, ctx: InputContext): InputResult {
  if (!ctx.connected) {
    return {
      next: {
        ...state,
        activeSkill: null,
        quickCast: false,
      },
    };
  }

  if (state.quickCast) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    const selfPos = localUnit(ctx).pos;
    if (coordsEqual(coord, selfPos)) {
      return {
        next: {
          ...state,
          quickCast: false,
        },
      };
    }
    if (containsCoord(quick.moveTargets, coord)) {
      return {
        next: {
          ...state,
          activeSkill: null,
          quickCast: false,
        },
        command: createMoveCommand(ctx.localSide, coord),
      };
    }
    if (containsCoord(quick.attackTargets, coord)) {
      return {
        next: {
          ...state,
          activeSkill: null,
          quickCast: false,
        },
        command: createAttackCommand(ctx.localSide, coord),
      };
    }
    return { next: { ...state } };
  }

  if (state.activeSkill === "move") {
    const legal = getLegalMoveTargets(ctx.game, ctx.localSide);
    if (!containsCoord(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createMoveCommand(ctx.localSide, coord),
    };
  }

  if (state.activeSkill === "build") {
    const legal = getLegalBuildTargets(ctx.game, ctx.localSide, state.spiritSpend);
    if (!containsCoord(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createBuildCommand(ctx.localSide, coord, state.spiritSpend),
    };
  }

  if (state.activeSkill === "attack") {
    const legal = getLegalAttackTargets(ctx.game, ctx.localSide);
    if (!containsCoord(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createAttackCommand(ctx.localSide, coord),
    };
  }

  if (state.activeSkill === "scout") {
    if (!canUseScout(ctx.game, ctx.localSide)) {
      return { next: { ...state, activeSkill: null } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createScoutCommand(ctx.localSide),
    };
  }

  if (state.activeSkill === "role1") {
    const selfPos = localUnit(ctx).pos;
    if (coordsEqual(selfPos, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createNeedleCommand(ctx.localSide, coord, state.spiritSpend),
    };
  }

  if (state.activeSkill === "role2") {
    const selfPos = localUnit(ctx).pos;
    if (coordsEqual(selfPos, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createAmuletCommand(ctx.localSide, coord),
    };
  }

  if (state.activeSkill === "role3") {
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createOrbCommand(ctx.localSide, state.spiritSpend),
    };
  }

  if (state.activeSkill === "role4") {
    const legal = getLegalBlinkTargets(ctx.game, ctx.localSide, state.spiritSpend);
    if (!containsCoord(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createBlinkCommand(ctx.localSide, coord, state.spiritSpend),
    };
  }

  const selfPos = localUnit(ctx).pos;
  if (coordsEqual(coord, selfPos) && canAct(ctx)) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    if (quick.moveTargets.length > 0 || quick.attackTargets.length > 0) {
      return {
        next: {
          ...state,
          quickCast: true,
          activeSkill: null,
        },
      };
    }
  }

  return { next: { ...state } };
}

export function onEndTurnClick(state: InputState, ctx: InputContext): InputResult {
  if (
    !ctx.connected ||
    ctx.ballisticPending ||
    ctx.game.turn.acted ||
    !canEndTurn(ctx.game, ctx.localSide)
  ) {
    return { next: { ...state } };
  }
  return {
    next: {
      ...state,
      activeSkill: null,
      quickCast: false,
    },
    command: createEndTurnCommand(ctx.localSide),
  };
}

export function getHighlights(state: InputState, ctx: InputContext): HighlightSet {
  if (state.quickCast) {
    const quick = getQuickCastTargets(ctx.game, ctx.localSide);
    return {
      moveHighlights: quick.moveTargets,
      attackHighlights: quick.attackTargets,
    };
  }

  if (state.activeSkill === "move") {
    return {
      moveHighlights: getLegalMoveTargets(ctx.game, ctx.localSide),
      attackHighlights: [],
    };
  }
  if (state.activeSkill === "build") {
    return {
      moveHighlights: getLegalBuildTargets(ctx.game, ctx.localSide, state.spiritSpend),
      attackHighlights: [],
    };
  }
  if (state.activeSkill === "attack") {
    return {
      moveHighlights: [],
      attackHighlights: getLegalAttackTargets(ctx.game, ctx.localSide),
    };
  }
  if (state.activeSkill === "role4") {
    return {
      moveHighlights: getLegalBlinkTargets(ctx.game, ctx.localSide, state.spiritSpend),
      attackHighlights: [],
    };
  }
  return {
    moveHighlights: [],
    attackHighlights: [],
  };
}

export function getSpiritSelectorView(state: InputState, ctx: InputContext): SpiritSelectorView {
  if (!isVariableSpiritSkill(state.activeSkill)) {
    return {
      visible: false,
      value: 0,
      min: 0,
      max: 0,
    };
  }
  const bounds = getSpiritSpendBounds(state.activeSkill, ctx);
  if (bounds.max < 1) {
    return {
      visible: false,
      value: 0,
      min: 0,
      max: 0,
    };
  }
  return {
    visible: true,
    value: Math.max(bounds.min, Math.min(bounds.max, state.spiritSpend)),
    min: bounds.min,
    max: bounds.max,
  };
}
