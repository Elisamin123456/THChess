import { ConnectRequest, createDebugPanel } from "./debug";
import { applyBpAction, createInitialBpState, getBpTurn, isBpDone, isBpOptionEnabled } from "./bp";
import {
  applyCommandEnvelope,
  buildPerspective,
  createEndTurnCommand,
  createInitialState,
  createMoveCommand,
  createUnlockSkillCommand,
  getLegalMoveTargets,
} from "./game";
import {
  createInitialInputState,
  getHighlights,
  getSkillAvailability,
  getSpiritSelectorView,
  onAdjustSpiritSpend as mapSpiritAdjust,
  onBoardClick as mapBoardClick,
  onEndTurnClick as mapEndTurnClick,
  onSkillClick as mapSkillClick,
} from "./input";
import {
  BpActionMessage,
  BpBanOptionId,
  Command,
  CommandEnvelope,
  GameState,
  NetMessage,
  Side,
  keyToCoord,
} from "./protocol";
import {
  ITransport,
  PeerRuntimeConfig,
  TransportStatus,
  createLoopbackTransport,
  createPeerJsTransport,
} from "./transport";
import { bootstrapReplayPage, buildReplayFilename, serializeReplay } from "./replay";
import { createGameView } from "./view";

function isCommandEnvelope(message: NetMessage): message is CommandEnvelope {
  return message.kind === "command";
}

function isBpActionMessage(message: NetMessage): message is BpActionMessage {
  return message.kind === "bpAction";
}

function createPeerId(): string {
  return `thchess-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInviteHash(peerId: string): string {
  return peerId;
}

function parseInviteHash(inviteHash: string): string | null {
  const code = inviteHash.trim();
  return code.length > 0 ? code : null;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function readPeerRuntimeConfig(): PeerRuntimeConfig {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const browserEnv =
    typeof window !== "undefined"
      ? (window as Window & { THCHESS_ICE_SERVERS_JSON?: string }).THCHESS_ICE_SERVERS_JSON
      : "";
  const raw = String(viteEnv?.VITE_ICE_SERVERS_JSON ?? browserEnv ?? "").trim();
  if (!raw) {
    return { iceServers: FALLBACK_ICE_SERVERS };
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { iceServers: parsed as RTCIceServer[] };
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("invalid VITE_ICE_SERVERS_JSON, fallback to default STUN", error);
  }

  return { iceServers: FALLBACK_ICE_SERVERS };
}

async function bootstrap(): Promise<void> {
  const appRoot = document.getElementById("app");
  const debugRoot = document.getElementById("debug-root");
  if (!appRoot || !debugRoot) {
    throw new Error("missing #app or #debug-root");
  }

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("replay")) {
    bootstrapReplayPage(appRoot, debugRoot);
    return;
  }

  const debugEnabled = searchParams.has("debug");
  const testMode = searchParams.has("test");
  const view = await createGameView(appRoot);
  const debugPanel = createDebugPanel(debugRoot, { debugEnabled });
  const replayDownloadLine = document.createElement("div");
  replayDownloadLine.className = "debug-line";
  replayDownloadLine.textContent = "Replay download available after match ends";
  replayDownloadLine.style.marginTop = "8px";
  const replayDownloadLink = document.createElement("a");
  replayDownloadLink.textContent = "download replay.rpy";
  replayDownloadLink.style.display = "none";
  replayDownloadLink.style.color = "#9ec8ff";
  replayDownloadLink.style.textDecoration = "underline";
  replayDownloadLine.appendChild(document.createTextNode(" "));
  replayDownloadLine.appendChild(replayDownloadLink);
  debugRoot.appendChild(replayDownloadLine);

  let state = createInitialState();
  if (testMode) {
    state.players.blue.stats.gold = 400;
    state.players.blue.stats.spirit = state.players.blue.stats.maxSpirit;
  }
  let replayInitialState: GameState = JSON.parse(JSON.stringify(state));
  let localSide: Side = testMode ? "blue" : debugPanel.getSelectedSide();
  let sessionPhase: "battle" | "bp" = "battle";
  let bpState = createInitialBpState();
  let bpSelectedOption: BpBanOptionId | null = null;
  let inputState = createInitialInputState();
  let transport: ITransport | null = null;
  let isConnected = testMode;
  let ballisticPending = false;
  let pendingRemoteId: string | null = null;
  let transportSeq = 0;
  let sessionMode: "receiver" | "connector" | null = null;
  let testAiTimer: number | null = null;
  let replayDownloadUrl: string | null = null;
  const replayCommands: CommandEnvelope[] = [];
  const peerRuntimeConfig = readPeerRuntimeConfig();

  const render = (): void => {
    if (sessionPhase === "bp") {
      view.renderBp({
        bp: bpState,
        localSide,
        connected: isConnected,
        selectedOption: bpSelectedOption,
      });
      return;
    }

    const ctx = { game: state, localSide, connected: isConnected, ballisticPending };
    view.render({
      state,
      perspective: buildPerspective(state, localSide),
      localSide,
      connected: isConnected,
      ballisticPending,
      input: inputState,
      highlights: getHighlights(inputState, ctx),
      skillAvailability: getSkillAvailability(ctx),
      spiritSelector: getSpiritSelectorView(inputState, ctx),
    });
    debugPanel.updateDualView(state);
    scheduleTestAiTurn();
  };

  const resetReplayDownload = (): void => {
    if (replayDownloadUrl) {
      URL.revokeObjectURL(replayDownloadUrl);
      replayDownloadUrl = null;
    }
    replayDownloadLink.style.display = "none";
    if (replayDownloadLine.firstChild) {
      replayDownloadLine.firstChild.textContent = "Replay download available after match ends";
    }
  };

  const startBattlePhase = (picks?: { blue: BpBanOptionId | null; red: BpBanOptionId | null }): void => {
    const bluePick = picks?.blue && picks.blue !== "none" ? picks.blue : null;
    const redPick = picks?.red && picks.red !== "none" ? picks.red : null;
    if (picks && (!bluePick || !redPick)) {
      debugPanel.log("BP is incomplete; cannot start battle");
      return;
    }

    state = bluePick && redPick ? createInitialState({ blue: bluePick, red: redPick }) : createInitialState();
    if (testMode) {
      state.players.blue.stats.gold = 400;
      state.players.blue.stats.spirit = state.players.blue.stats.maxSpirit;
    }
    replayInitialState = JSON.parse(JSON.stringify(state));
    replayCommands.length = 0;
    resetReplayDownload();
    inputState = createInitialInputState();
    ballisticPending = false;
    bpSelectedOption = null;
    sessionPhase = "battle";
  };

  const startBpPhase = (): void => {
    sessionPhase = "bp";
    bpState = createInitialBpState();
    bpSelectedOption = null;
    inputState = createInitialInputState();
    ballisticPending = false;
  };

  const applyBpMessage = (message: BpActionMessage, source: "local" | "remote"): boolean => {
    if (sessionPhase !== "bp") {
      debugPanel.log(`${source} BP message ignored: not in BP phase`);
      return false;
    }
    const outcome = applyBpAction(bpState, {
      actor: message.actor,
      action: message.action,
      mechId: message.mechId,
    });
    if (outcome.ok === false) {
      debugPanel.log(`${source} BP action rejected: ${outcome.reason}`);
      return false;
    }

    bpState = outcome.state;
    bpSelectedOption = null;

    if (isBpDone(bpState)) {
      startBattlePhase({
        blue: bpState.sides.blue.pick,
        red: bpState.sides.red.pick,
      });
    }

    render();
    return true;
  };

  const applyEnvelope = (envelope: CommandEnvelope, source: "local" | "remote"): boolean => {
    const prevState = state;
    const outcome = applyCommandEnvelope(state, envelope);
    if (outcome.ok === false) {
      debugPanel.log(`${source} \u547d\u4ee4\u62d2\u7edd: ${outcome.reason}`);
      return false;
    }

    state = outcome.state;
    replayCommands.push(envelope);
    inputState = createInitialInputState();
    if (envelope.command.type === "endTurn") {
      ballisticPending = false;
    }

    if (envelope.command.type === "attack") {
      const target = keyToCoord(envelope.command.to);
      if (target) {
        view.playAttackAnimation(envelope.command.actor, prevState.players[envelope.command.actor].pos, target);
      }
    }

    const projectiles = outcome.effects?.projectiles ?? [];
    if (projectiles.length > 0) {
      const lockLocalEndTurn = envelope.command.actor === localSide;
      if (lockLocalEndTurn) {
        ballisticPending = true;
      }
      void view.playProjectileAnimations(projectiles).then(() => {
        if (lockLocalEndTurn) {
          ballisticPending = false;
          render();
        }
      });
    }

    if (!prevState.winner && state.winner) {
      if (replayDownloadUrl) {
        URL.revokeObjectURL(replayDownloadUrl);
      }
      const replayContent = serializeReplay(replayCommands, replayInitialState);
      replayDownloadUrl = URL.createObjectURL(
        new Blob([replayContent], { type: "text/plain;charset=utf-8" }),
      );
      replayDownloadLink.href = replayDownloadUrl;
      replayDownloadLink.download = buildReplayFilename(new Date());
      replayDownloadLink.style.display = "inline";
      replayDownloadLine.firstChild!.textContent = "Replay file is ready:";
    }

    render();
    return true;
  };

  const sendEnvelope = (envelope: CommandEnvelope): void => {
    if (testMode) {
      return;
    }
    if (!transport || !isConnected) {
      debugPanel.log("Not connected, command not sent");
      return;
    }
    if (debugEnabled) {
      debugPanel.log(
        `send command seq=${envelope.seq} actor=${envelope.command.actor} type=${envelope.command.type}`,
      );
    }
    transport.send(envelope);
  };

  const sendBpMessage = (message: BpActionMessage): void => {
    if (testMode) {
      return;
    }
    if (!transport || !isConnected) {
      debugPanel.log("Not connected, BP action not sent");
      return;
    }
    if (debugEnabled) {
      debugPanel.log(
        `send bp actor=${message.actor} action=${message.action} mech=${message.mechId}`
      );
    }
    transport.send(message);
  };

  const issueLocalCommand = (command: Command): void => {
    if (sessionPhase !== "battle") {
      debugPanel.log("Cannot issue battle command during BP phase");
      return;
    }
    if (!isConnected) {
      debugPanel.log("\u8fde\u63a5\u672a\u5b8c\u6210\uff0c\u6682\u65f6\u65e0\u6cd5\u64cd\u4f5c");
      return;
    }
    if (testMode && command.actor !== localSide) {
      debugPanel.log("test\u6a21\u5f0f\u4e0b\u4ec5\u652f\u6301\u64cd\u4f5cP1/\u84dd\u65b9");
      return;
    }
    const envelope: CommandEnvelope = {
      kind: "command",
      seq: state.seq + 1,
      command,
    };
    if (applyEnvelope(envelope, "local")) {
      sendEnvelope(envelope);
    }
  };

  const issueLocalBpConfirm = (): void => {
    if (sessionPhase !== "bp") {
      return;
    }
    if (!isConnected) {
      debugPanel.log("Not connected yet, BP action is unavailable");
      return;
    }
    const turn = getBpTurn(bpState);
    if (!turn) {
      debugPanel.log("BP already completed");
      return;
    }
    if (turn.side !== localSide) {
      debugPanel.log("It is not your BP turn");
      return;
    }
    if (!bpSelectedOption) {
      debugPanel.log("Please select a BP option first");
      return;
    }
    if (turn.action === "pick" && bpSelectedOption === "none") {
      debugPanel.log("Empty pick is not allowed");
      return;
    }
    if (!isBpOptionEnabled(bpState, localSide, bpSelectedOption)) {
      debugPanel.log("This BP option cannot be confirmed now");
      return;
    }
    const message: BpActionMessage = {
      kind: "bpAction",
      actor: localSide,
      action: turn.action,
      mechId: bpSelectedOption,
    };
    if (applyBpMessage(message, "local")) {
      sendBpMessage(message);
    }
  };

  const runTestAiTurn = (): void => {
    if (!testMode || sessionPhase !== "battle" || state.winner || state.turn.side !== "red" || ballisticPending) {
      return;
    }

    const legalMoves = getLegalMoveTargets(state, "red");
    if (legalMoves.length > 0) {
      const target = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      const moveEnvelope: CommandEnvelope = {
        kind: "command",
        seq: state.seq + 1,
        command: createMoveCommand("red", target),
      };
      applyEnvelope(moveEnvelope, "local");
      return;
    }

    if (!state.winner && state.turn.side === "red" && !state.turn.acted) {
      const endTurnEnvelope: CommandEnvelope = {
        kind: "command",
        seq: state.seq + 1,
        command: createEndTurnCommand("red"),
      };
      applyEnvelope(endTurnEnvelope, "local");
    }
  };

  const scheduleTestAiTurn = (): void => {
    if (!testMode) {
      return;
    }
    if (testAiTimer !== null) {
      window.clearTimeout(testAiTimer);
      testAiTimer = null;
    }
    if (sessionPhase !== "battle" || state.winner || ballisticPending || state.turn.side !== "red" || state.turn.acted) {
      return;
    }
    testAiTimer = window.setTimeout(() => {
      testAiTimer = null;
      runTestAiTurn();
    }, 220);
  };

  const applyTransportStatus = (status: TransportStatus, mySeq: number): void => {
    if (mySeq !== transportSeq) {
      return;
    }

    debugPanel.setTransportStatus(status);

    if (status.type === "connected") {
      isConnected = true;
      if (!testMode) {
        startBpPhase();
      }
      render();
      return;
    }

    if (status.type === "ready") {
      isConnected = false;
      inputState = createInitialInputState();
      ballisticPending = false;
      if (!testMode) {
        sessionPhase = "battle";
        bpSelectedOption = null;
      }
      if (sessionMode === "receiver" && transport) {
        const invite = buildInviteHash(transport.getLocalId());
        debugPanel.setInviteHash(invite);
      }
      if (sessionMode === "connector" && pendingRemoteId && transport) {
        const remoteId = pendingRemoteId;
        pendingRemoteId = null;
        transport.connect(remoteId);
      }
      render();
      return;
    }

    if (status.type === "connecting") {
      isConnected = false;
      inputState = createInitialInputState();
      ballisticPending = false;
      if (!testMode) {
        sessionPhase = "battle";
        bpSelectedOption = null;
      }
      render();
      return;
    }

    isConnected = false;
    inputState = createInitialInputState();
    ballisticPending = false;
    if (!testMode) {
      sessionPhase = "battle";
      bpSelectedOption = null;
    }
    render();
  };

  const bindTransport = (next: ITransport): void => {
    if (transport) {
      transport.dispose();
    }
    transport = next;
    transportSeq += 1;
    const mySeq = transportSeq;

    transport.onStatus((status) => {
      applyTransportStatus(status, mySeq);
    });

    transport.onMessage((message: NetMessage) => {
      if (mySeq !== transportSeq) {
        return;
      }
      if (isBpActionMessage(message)) {
        if (debugEnabled) {
          debugPanel.log(
            `recv bp actor=${message.actor} action=${message.action} mech=${message.mechId}`,
          );
        }
        if (transport?.name === "loopback" && message.actor === localSide) {
          return;
        }
        applyBpMessage(message, "remote");
        return;
      }
      if (isCommandEnvelope(message)) {
        if (sessionPhase !== "battle") {
          debugPanel.log("Received command during BP phase; ignored");
          return;
        }
        if (debugEnabled) {
          debugPanel.log(
            `recv command seq=${message.seq} actor=${message.command.actor} type=${message.command.type}`,
          );
        }
        if (transport?.name === "loopback" && message.command.actor === localSide) {
          return;
        }
        applyEnvelope(message, "remote");
        return;
      }
    });

    transport.start();
  };

  view.setHandlers({
    onSkillClick(skill) {
      if (sessionPhase !== "battle") {
        return;
      }
      const next = mapSkillClick(inputState, skill, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending,
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onCellClick(coord) {
      if (sessionPhase !== "battle") {
        return;
      }
      const next = mapBoardClick(inputState, coord, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending,
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onEndTurnClick() {
      if (sessionPhase !== "battle") {
        return;
      }
      const next = mapEndTurnClick(inputState, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending,
      });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onSpiritAdjust(delta) {
      if (sessionPhase !== "battle") {
        return;
      }
      const next = mapSpiritAdjust(inputState, delta, {
        game: state,
        localSide,
        connected: isConnected,
        ballisticPending,
      });
      inputState = next.next;
      render();
    },
    onUnlockSkill(skill) {
      if (sessionPhase !== "battle") {
        return;
      }
      issueLocalCommand(createUnlockSkillCommand(localSide, skill));
    },
    onBpOptionClick(optionId) {
      if (sessionPhase !== "bp") {
        return;
      }
      bpSelectedOption = optionId;
      render();
    },
    onBpConfirm() {
      issueLocalBpConfirm();
    },
  });

  debugPanel.onSideChange((side) => {
    if (testMode) {
      localSide = "blue";
      inputState = createInitialInputState();
      ballisticPending = false;
      bpSelectedOption = null;
      debugPanel.log("test\u6a21\u5f0f\u4e0b\u672c\u673a\u63a7\u5236\u65b9\u56fa\u5b9a\u4e3a P1/\u84dd\u65b9");
      render();
      return;
    }
    localSide = side;
    inputState = createInitialInputState();
    ballisticPending = false;
    bpSelectedOption = null;
    debugPanel.log(
      `\u672c\u673a\u63a7\u5236\u65b9: ${side === "blue" ? "P1/\u84dd\u65b9" : "P2/\u7ea2\u65b9"}`,
    );
    render();
  });

  debugPanel.onConnectAction((request: ConnectRequest) => {
    if (testMode) {
      debugPanel.log("test\u6a21\u5f0f\u65e0\u9700\u8054\u673a");
      return;
    }
    debugPanel.setInviteHash("");
    inputState = createInitialInputState();
    ballisticPending = false;
    sessionPhase = "battle";
    bpSelectedOption = null;

    if (request.mode === "receiver") {
      sessionMode = "receiver";
      pendingRemoteId = null;
      bindTransport(createPeerJsTransport(createPeerId(), peerRuntimeConfig));
      debugPanel.log("\u5df2\u542f\u52a8\u63a5\u6536\u6a21\u5f0f\uff0c\u7b49\u5f85\u751f\u6210\u8054\u673a\u7801");
      return;
    }

    const remoteId = parseInviteHash(request.codeInput);
    if (!remoteId) {
      debugPanel.log("\u8054\u673a\u7801\u65e0\u6548");
      return;
    }

    sessionMode = "connector";
    pendingRemoteId = remoteId;
    bindTransport(createPeerJsTransport(createPeerId(), peerRuntimeConfig));
    debugPanel.log("\u5df2\u542f\u52a8\u8fde\u63a5\u6a21\u5f0f\uff0c\u6b63\u5728\u8fde\u63a5\u8fdc\u7aef");
  });

  debugPanel.onStartLoopback(() => {
    if (testMode) {
      debugPanel.log("test\u6a21\u5f0f\u65e0\u9700\u8054\u673a");
      return;
    }
    sessionMode = null;
    pendingRemoteId = null;
    ballisticPending = false;
    sessionPhase = "battle";
    bpSelectedOption = null;
    const loopback = createLoopbackTransport();
    bindTransport(loopback);
    loopback.connect("self");
  });

  if (testMode) {
    debugPanel.setTransportStatus({ type: "connected", detail: "test mode local" });
    debugPanel.log("test\u6a21\u5f0f\u5df2\u542f\u7528\uff1aP1\u4e3a\u73a9\u5bb6\uff0cP2\u4e3a\u968f\u673a\u79fb\u52a8AI");
  }
  render();
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});

