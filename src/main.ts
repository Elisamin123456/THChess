import { ConnectRequest, createDebugPanel } from "./debug";
import { applyCommandEnvelope, buildPerspective, computeStateHash, createInitialState } from "./game";
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
import { Command, CommandEnvelope, DebugHashMessage, NetMessage, Side, keyToCoord } from "./protocol";
import { ITransport, TransportStatus, createLoopbackTransport, createPeerJsTransport } from "./transport";
import { createGameView } from "./view";

function isCommandEnvelope(message: NetMessage): message is CommandEnvelope {
  return message.kind === "command";
}

function isDebugHash(message: NetMessage): message is DebugHashMessage {
  return message.kind === "debugHash";
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

async function bootstrap(): Promise<void> {
  const appRoot = document.getElementById("app");
  const debugRoot = document.getElementById("debug-root");
  if (!appRoot || !debugRoot) {
    throw new Error("missing #app or #debug-root");
  }

  const debugEnabled = new URLSearchParams(window.location.search).has("debug");
  const view = await createGameView(appRoot);
  const debugPanel = createDebugPanel(debugRoot, { debugEnabled });

  let state = createInitialState();
  let localSide: Side = debugPanel.getSelectedSide();
  let inputState = createInitialInputState();
  let transport: ITransport | null = null;
  let isConnected = false;
  let pendingRemoteId: string | null = null;
  let transportSeq = 0;
  let sessionMode: "receiver" | "connector" | null = null;

  const render = (): void => {
    const ctx = { game: state, localSide, connected: isConnected };
    view.render({
      state,
      perspective: buildPerspective(state, localSide),
      localSide,
      connected: isConnected,
      input: inputState,
      highlights: getHighlights(inputState, ctx),
      skillAvailability: getSkillAvailability(ctx),
      spiritSelector: getSpiritSelectorView(inputState, ctx),
    });
    debugPanel.updateDualView(state);
  };

  const broadcastHash = (): void => {
    if (!debugEnabled) {
      return;
    }
    const hash = computeStateHash(state);
    debugPanel.recordLocalHash(state.seq, hash);
    if (transport && isConnected) {
      transport.send({
        kind: "debugHash",
        seq: state.seq,
        hash,
      });
    }
  };

  const applyEnvelope = (envelope: CommandEnvelope, source: "local" | "remote"): boolean => {
    const prevState = state;
    const outcome = applyCommandEnvelope(state, envelope);
    if (!outcome.ok) {
      debugPanel.log(`${source} \u547d\u4ee4\u62d2\u7edd: ${outcome.reason}`);
      return false;
    }

    state = outcome.state;
    inputState = createInitialInputState();

    if (envelope.command.type === "attack") {
      const target = keyToCoord(envelope.command.to);
      if (target) {
        view.playAttackAnimation(envelope.command.actor, prevState.players[envelope.command.actor].pos, target);
      }
    }

    render();
    broadcastHash();
    return true;
  };

  const sendEnvelope = (envelope: CommandEnvelope): void => {
    if (!transport || !isConnected) {
      debugPanel.log("\u672a\u8fde\u63a5\uff0c\u547d\u4ee4\u672a\u53d1\u9001");
      return;
    }
    if (debugEnabled) {
      debugPanel.log(
        `send command seq=${envelope.seq} actor=${envelope.command.actor} type=${envelope.command.type}`,
      );
    }
    transport.send(envelope);
  };

  const issueLocalCommand = (command: Command): void => {
    if (!isConnected) {
      debugPanel.log("\u8fde\u63a5\u672a\u5b8c\u6210\uff0c\u6682\u65f6\u65e0\u6cd5\u64cd\u4f5c");
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

  const applyTransportStatus = (status: TransportStatus, mySeq: number): void => {
    if (mySeq !== transportSeq) {
      return;
    }

    debugPanel.setTransportStatus(status);

    if (status.type === "connected") {
      isConnected = true;
      render();
      return;
    }

    if (status.type === "ready") {
      isConnected = false;
      inputState = createInitialInputState();
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
      render();
      return;
    }

    isConnected = false;
    inputState = createInitialInputState();
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
      if (isCommandEnvelope(message)) {
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
      if (isDebugHash(message) && debugEnabled) {
        debugPanel.log(`recv hash seq=${message.seq} hash=${message.hash}`);
        debugPanel.recordRemoteHash(message.seq, message.hash);
      }
    });

    transport.start();
  };

  view.setHandlers({
    onSkillClick(skill) {
      const next = mapSkillClick(inputState, skill, { game: state, localSide, connected: isConnected });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onCellClick(coord) {
      const next = mapBoardClick(inputState, coord, { game: state, localSide, connected: isConnected });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onEndTurnClick() {
      const next = mapEndTurnClick(inputState, { game: state, localSide, connected: isConnected });
      inputState = next.next;
      if (next.command) {
        issueLocalCommand(next.command);
      } else {
        render();
      }
    },
    onSpiritAdjust(delta) {
      const next = mapSpiritAdjust(inputState, delta, { game: state, localSide, connected: isConnected });
      inputState = next.next;
      render();
    },
  });

  debugPanel.onSideChange((side) => {
    localSide = side;
    inputState = createInitialInputState();
    debugPanel.log(
      `\u672c\u673a\u63a7\u5236\u65b9: ${side === "blue" ? "P1/\u84dd\u65b9" : "P2/\u7ea2\u65b9"}`,
    );
    render();
  });

  debugPanel.onConnectAction((request: ConnectRequest) => {
    debugPanel.setInviteHash("");
    inputState = createInitialInputState();

    if (request.mode === "receiver") {
      sessionMode = "receiver";
      pendingRemoteId = null;
      bindTransport(createPeerJsTransport(createPeerId()));
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
    bindTransport(createPeerJsTransport(createPeerId()));
    debugPanel.log("\u5df2\u542f\u52a8\u8fde\u63a5\u6a21\u5f0f\uff0c\u6b63\u5728\u8fde\u63a5\u8fdc\u7aef");
  });

  debugPanel.onStartLoopback(() => {
    sessionMode = null;
    pendingRemoteId = null;
    const loopback = createLoopbackTransport();
    bindTransport(loopback);
    loopback.connect("self");
  });

  render();
  broadcastHash();
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});

