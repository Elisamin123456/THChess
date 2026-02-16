import {
  canEndTurn,
  canUseScout,
  createAttackCommand,
  createBuildCommand,
  createEndTurnCommand,
  createMoveCommand,
  createScoutCommand,
  getLegalAttackTargets,
  getLegalBuildTargets,
  getLegalMoveTargets,
  getQuickCastTargets,
} from "./game";
import { Command, Coord, GameState, Side, SkillId, coordsEqual } from "./protocol";

export interface InputState {
  activeSkill: SkillId | null;
  quickCast: boolean;
  buildSpiritSpend: number;
}

export interface InputContext {
  game: GameState;
  localSide: Side;
  connected: boolean;
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

export interface SkillAvailability {
  move: boolean;
  build: boolean;
  scout: boolean;
  attack: boolean;
}

function containsCoord(list: Coord[], target: Coord): boolean {
  return list.some((item) => coordsEqual(item, target));
}

function canAct(ctx: InputContext): boolean {
  return (
    ctx.connected &&
    !ctx.game.winner &&
    ctx.game.turn.side === ctx.localSide &&
    !ctx.game.turn.acted
  );
}

function getBuildSpendBounds(ctx: InputContext): { min: number; max: number } {
  const max = Math.max(0, Math.floor(ctx.game.players[ctx.localSide].stats.spirit));
  return { min: max > 0 ? 1 : 0, max };
}

function hasAnyBuildTarget(ctx: InputContext): boolean {
  const bounds = getBuildSpendBounds(ctx);
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

export function createInitialInputState(): InputState {
  return {
    activeSkill: null,
    quickCast: false,
    buildSpiritSpend: 1,
  };
}

export function getSkillAvailability(ctx: InputContext): SkillAvailability {
  if (!canAct(ctx)) {
    return {
      move: false,
      build: false,
      scout: false,
      attack: false,
    };
  }
  return {
    move: getLegalMoveTargets(ctx.game, ctx.localSide).length > 0,
    build: hasAnyBuildTarget(ctx),
    scout: canUseScout(ctx.game, ctx.localSide),
    attack: getLegalAttackTargets(ctx.game, ctx.localSide).length > 0,
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
  if (skill === "move" && !availability.move) {
    return { next: { ...nextState, activeSkill: null } };
  }
  if (skill === "build" && !availability.build) {
    return { next: { ...nextState, activeSkill: null } };
  }
  if (skill === "scout" && !availability.scout) {
    return { next: { ...nextState, activeSkill: null } };
  }
  if (skill === "attack" && !availability.attack) {
    return { next: { ...nextState, activeSkill: null } };
  }
  if (skill !== "move" && skill !== "build" && skill !== "scout" && skill !== "attack") {
    return { next: { ...nextState, activeSkill: null } };
  }

  const bounds = getBuildSpendBounds(ctx);
  const clampedSpend = Math.max(bounds.min || 1, Math.min(bounds.max || 1, nextState.buildSpiritSpend));
  return {
    next: {
      ...nextState,
      activeSkill: skill,
      buildSpiritSpend: clampedSpend,
    },
  };
}

export function onAdjustSpiritSpend(state: InputState, delta: number, ctx: InputContext): InputResult {
  if (state.activeSkill !== "build") {
    return { next: { ...state } };
  }
  const bounds = getBuildSpendBounds(ctx);
  if (bounds.max < 1) {
    return {
      next: {
        ...state,
        buildSpiritSpend: 1,
      },
    };
  }
  const nextSpend = Math.max(bounds.min, Math.min(bounds.max, state.buildSpiritSpend + delta));
  return {
    next: {
      ...state,
      buildSpiritSpend: nextSpend,
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
    const selfPos = ctx.game.players[ctx.localSide].pos;
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
    const legal = getLegalBuildTargets(ctx.game, ctx.localSide, state.buildSpiritSpend);
    if (!containsCoord(legal, coord)) {
      return { next: { ...state } };
    }
    return {
      next: {
        ...state,
        activeSkill: null,
      },
      command: createBuildCommand(ctx.localSide, coord, state.buildSpiritSpend),
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

  const selfPos = ctx.game.players[ctx.localSide].pos;
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
  if (!ctx.connected || !canEndTurn(ctx.game, ctx.localSide)) {
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
      moveHighlights: getLegalBuildTargets(ctx.game, ctx.localSide, state.buildSpiritSpend),
      attackHighlights: [],
    };
  }
  if (state.activeSkill === "attack") {
    return {
      moveHighlights: [],
      attackHighlights: getLegalAttackTargets(ctx.game, ctx.localSide),
    };
  }
  return {
    moveHighlights: [],
    attackHighlights: [],
  };
}

export function getSpiritSelectorView(state: InputState, ctx: InputContext): SpiritSelectorView {
  if (state.activeSkill !== "build") {
    return {
      visible: false,
      value: 0,
      min: 0,
      max: 0,
    };
  }
  const bounds = getBuildSpendBounds(ctx);
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
    value: Math.max(bounds.min, Math.min(bounds.max, state.buildSpiritSpend)),
    min: bounds.min,
    max: bounds.max,
  };
}
