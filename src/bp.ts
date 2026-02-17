import { BpActionType, BpBanOptionId, MechId, Side, oppositeSide } from "./protocol";

export type BpPhase = "blueBan" | "redBan" | "redPick" | "bluePick" | "done";

export interface SideBpState {
  ban: BpBanOptionId | null;
  pick: MechId | null;
}

export interface BpState {
  phase: BpPhase;
  sides: Record<Side, SideBpState>;
}

export interface BpAction {
  actor: Side;
  action: BpActionType;
  mechId: BpBanOptionId;
}

export interface BpTurn {
  side: Side;
  action: BpActionType;
}

export type BpApplyOutcome =
  | {
      ok: true;
      state: BpState;
    }
  | {
      ok: false;
      reason: string;
    };

export function createInitialBpState(): BpState {
  return {
    phase: "blueBan",
    sides: {
      blue: { ban: null, pick: null },
      red: { ban: null, pick: null },
    },
  };
}

export function isBpDone(state: BpState): boolean {
  return state.phase === "done";
}

export function getBpTurn(state: BpState): BpTurn | null {
  switch (state.phase) {
    case "blueBan":
      return { side: "blue", action: "ban" };
    case "redBan":
      return { side: "red", action: "ban" };
    case "redPick":
      return { side: "red", action: "pick" };
    case "bluePick":
      return { side: "blue", action: "pick" };
    case "done":
      return null;
    default:
      return null;
  }
}

export function getBpPhaseLabel(state: BpState): string {
  switch (state.phase) {
    case "blueBan":
      return "Blue Ban";
    case "redBan":
      return "Red Ban";
    case "redPick":
      return "Red Pick";
    case "bluePick":
      return "Blue Pick";
    case "done":
      return "BP Done";
    default:
      return "BP";
  }
}

export function getBanAgainst(state: BpState, side: Side): BpBanOptionId | null {
  return state.sides[oppositeSide(side)].ban;
}

export function canPickMech(state: BpState, side: Side, mechId: MechId): boolean {
  const banned = getBanAgainst(state, side);
  return banned !== mechId;
}

export function isBpOptionEnabled(state: BpState, side: Side, optionId: BpBanOptionId): boolean {
  const turn = getBpTurn(state);
  if (!turn || turn.side !== side) {
    return false;
  }
  if (turn.action === "ban") {
    return true;
  }
  if (optionId === "none") {
    return false;
  }
  return canPickMech(state, side, optionId);
}

function getNextPhase(phase: BpPhase): BpPhase {
  switch (phase) {
    case "blueBan":
      return "redBan";
    case "redBan":
      return "redPick";
    case "redPick":
      return "bluePick";
    case "bluePick":
      return "done";
    case "done":
      return "done";
    default:
      return "done";
  }
}

export function applyBpAction(state: BpState, action: BpAction): BpApplyOutcome {
  const turn = getBpTurn(state);
  if (!turn) {
    return { ok: false, reason: "bp already completed" };
  }
  if (action.actor !== turn.side) {
    return { ok: false, reason: "not this side's bp turn" };
  }
  if (action.action !== turn.action) {
    return { ok: false, reason: "invalid bp action type for current phase" };
  }

  if (action.action === "pick") {
    if (action.mechId === "none") {
      return { ok: false, reason: "pick cannot be empty ban option" };
    }
    if (!canPickMech(state, action.actor, action.mechId)) {
      return { ok: false, reason: "selected mech is banned for this side" };
    }
  }

  const next: BpState = {
    phase: getNextPhase(state.phase),
    sides: {
      blue: { ...state.sides.blue },
      red: { ...state.sides.red },
    },
  };

  if (action.action === "ban") {
    next.sides[action.actor].ban = action.mechId;
  } else {
    if (action.mechId === "none") {
      return { ok: false, reason: "pick cannot be empty ban option" };
    }
    next.sides[action.actor].pick = action.mechId;
  }

  if (next.phase === "done" && (next.sides.blue.pick === null || next.sides.red.pick === null)) {
    return { ok: false, reason: "bp ended without both picks" };
  }

  return {
    ok: true,
    state: next,
  };
}
