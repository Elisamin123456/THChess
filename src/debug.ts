import { buildPerspective } from "./game";
import { GameState, Side, coordToKey } from "./protocol";
import { TransportStatus } from "./transport";

export interface ConnectRequest {
  mode: "receiver" | "connector";
  codeInput: string;
}

interface DebugHandlers {
  onConnectAction: ((request: ConnectRequest) => void) | null;
  onStartLoopback: (() => void) | null;
  onSideChange: ((side: Side) => void) | null;
}

export interface DebugPanelOptions {
  debugEnabled: boolean;
}

export interface DebugPanel {
  onConnectAction(handler: (request: ConnectRequest) => void): void;
  onStartLoopback(handler: () => void): void;
  onSideChange(handler: (side: Side) => void): void;
  getSelectedSide(): Side;
  setTransportStatus(status: TransportStatus): void;
  setInviteHash(value: string): void;
  log(message: string): void;
  recordLocalHash(seq: number, hash: string): void;
  recordRemoteHash(seq: number, hash: string): void;
  updateDualView(state: GameState): void;
}

function nowTimeText(): string {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function createDebugPanel(root: HTMLElement, options: DebugPanelOptions): DebugPanel {
  const handlers: DebugHandlers = {
    onConnectAction: null,
    onStartLoopback: null,
    onSideChange: null,
  };

  const localHashMap = new Map<number, string>();
  const remoteHashMap = new Map<number, string>();

  const wrapper = document.createElement("section");
  wrapper.className = "panel debug-panel";

  const title = document.createElement("h3");
  title.className = "debug-title";
  title.textContent = options.debugEnabled ? "\u8054\u673a Debug" : "\u8054\u673a";
  wrapper.appendChild(title);

  const controlRow = document.createElement("div");
  controlRow.className = "debug-controls";

  const sideSelect = document.createElement("select");
  sideSelect.className = "debug-input";
  sideSelect.innerHTML =
    '<option value="blue">P1 / \u84dd\u65b9</option><option value="red">P2 / \u7ea2\u65b9</option>';
  controlRow.appendChild(sideSelect);

  const modeSelect = document.createElement("select");
  modeSelect.className = "debug-input";
  modeSelect.innerHTML =
    '<option value="receiver">\u63a5\u6536\u6a21\u5f0f</option><option value="connector">\u8fde\u63a5\u6a21\u5f0f</option>';
  controlRow.appendChild(modeSelect);

  const hashInput = document.createElement("input");
  hashInput.className = "debug-input";
  hashInput.placeholder = "\u8fde\u63a5\u6a21\u5f0f\u8f93\u5165\u8fde\u63a5\u7801";
  controlRow.appendChild(hashInput);

  const connectBtn = document.createElement("button");
  connectBtn.className = "debug-btn";
  connectBtn.textContent = "\u542f\u52a8\u8054\u673a";
  controlRow.appendChild(connectBtn);

  const loopbackBtn = document.createElement("button");
  loopbackBtn.className = "debug-btn";
  loopbackBtn.textContent = "Loopback";
  if (options.debugEnabled) {
    controlRow.appendChild(loopbackBtn);
  }

  wrapper.appendChild(controlRow);

  const inviteLine = document.createElement("div");
  inviteLine.className = "debug-line";
  inviteLine.textContent = "\u8fde\u63a5\u7801: -";
  wrapper.appendChild(inviteLine);

  const statusLine = document.createElement("div");
  statusLine.className = "debug-line";
  statusLine.textContent = "\u72b6\u6001: idle";
  wrapper.appendChild(statusLine);

  const hashLine = document.createElement("div");
  hashLine.className = "debug-line";
  hashLine.textContent = "\u6821\u9a8c: \u7b49\u5f85\u547d\u4ee4";
  wrapper.appendChild(hashLine);

  const dualViewLineBlue = document.createElement("div");
  dualViewLineBlue.className = "debug-line";
  dualViewLineBlue.textContent = "\u84dd\u65b9\u89c6\u89d2: -";
  wrapper.appendChild(dualViewLineBlue);

  const dualViewLineRed = document.createElement("div");
  dualViewLineRed.className = "debug-line";
  dualViewLineRed.textContent = "\u7ea2\u65b9\u89c6\u89d2: -";
  wrapper.appendChild(dualViewLineRed);

  const logBox = document.createElement("pre");
  logBox.className = "debug-log";
  wrapper.appendChild(logBox);

  root.appendChild(wrapper);

  if (!options.debugEnabled) {
    hashLine.style.display = "none";
    dualViewLineBlue.style.display = "none";
    dualViewLineRed.style.display = "none";
    logBox.style.display = "none";
  }

  function appendLog(message: string): void {
    if (!options.debugEnabled) {
      return;
    }
    const line = `[${nowTimeText()}] ${message}`;
    if (!logBox.textContent) {
      logBox.textContent = line;
      return;
    }
    const next = `${line}\n${logBox.textContent}`;
    logBox.textContent = next.split("\n").slice(0, 20).join("\n");
  }

  function updateHashLine(latestSeq: number): void {
    if (!options.debugEnabled) {
      return;
    }
    const localHash = localHashMap.get(latestSeq);
    const remoteHash = remoteHashMap.get(latestSeq);
    if (!localHash) {
      hashLine.textContent = "\u6821\u9a8c: \u672c\u5730\u8fd8\u6ca1\u6709\u53ef\u6bd4\u8f83 hash";
      return;
    }
    if (!remoteHash) {
      hashLine.textContent = `\u6821\u9a8c: seq=${latestSeq} \u672c\u5730=${localHash} | \u8fdc\u7aef\u7b49\u5f85\u4e2d`;
      return;
    }
    const matched = localHash === remoteHash;
    hashLine.textContent =
      `\u6821\u9a8c: seq=${latestSeq} \u672c\u5730=${localHash} ` +
      `\u8fdc\u7aef=${remoteHash} => ${matched ? "\u4e00\u81f4" : "\u4e0d\u4e00\u81f4"}`;
    if (!matched) {
      appendLog(`seq=${latestSeq} hash \u4e0d\u4e00\u81f4`);
    }
  }

  function refreshModeUi(): void {
    const isConnector = modeSelect.value === "connector";
    hashInput.disabled = !isConnector;
    hashInput.style.opacity = isConnector ? "1" : "0.65";
    hashInput.placeholder = isConnector
      ? "\u8fde\u63a5\u6a21\u5f0f\u8f93\u5165\u8fde\u63a5\u7801"
      : "\u63a5\u6536\u6a21\u5f0f\u65e0\u9700\u8f93\u5165";
  }

  modeSelect.addEventListener("change", refreshModeUi);
  refreshModeUi();

  sideSelect.addEventListener("change", () => {
    const side = sideSelect.value === "red" ? "red" : "blue";
    handlers.onSideChange?.(side);
    appendLog(
      `\u672c\u673a\u8eab\u4efd\u5207\u6362\u4e3a ${
        side === "blue" ? "P1/\u84dd\u65b9" : "P2/\u7ea2\u65b9"
      }`,
    );
  });

  connectBtn.addEventListener("click", () => {
    const mode = modeSelect.value === "connector" ? "connector" : "receiver";
    handlers.onConnectAction?.({
      mode,
      codeInput: hashInput.value.trim(),
    });
  });

  loopbackBtn.addEventListener("click", () => {
    handlers.onStartLoopback?.();
  });

  return {
    onConnectAction(handler: (request: ConnectRequest) => void): void {
      handlers.onConnectAction = handler;
    },
    onStartLoopback(handler: () => void): void {
      handlers.onStartLoopback = handler;
    },
    onSideChange(handler: (side: Side) => void): void {
      handlers.onSideChange = handler;
    },
    getSelectedSide(): Side {
      return sideSelect.value === "red" ? "red" : "blue";
    },
    setTransportStatus(status: TransportStatus): void {
      statusLine.textContent = `\u72b6\u6001: ${status.type} | ${status.detail}`;
      appendLog(`\u72b6\u6001\u66f4\u65b0: ${status.type} | ${status.detail}`);
    },
    setInviteHash(value: string): void {
      inviteLine.textContent = value
        ? `\u8fde\u63a5\u7801: ${value}`
        : "\u8fde\u63a5\u7801: -";
    },
    log(message: string): void {
      if (options.debugEnabled) {
        appendLog(message);
      } else {
        statusLine.textContent = `\u72b6\u6001: info | ${message}`;
      }
    },
    recordLocalHash(seq: number, hash: string): void {
      localHashMap.set(seq, hash);
      updateHashLine(seq);
    },
    recordRemoteHash(seq: number, hash: string): void {
      remoteHashMap.set(seq, hash);
      updateHashLine(seq);
    },
    updateDualView(state: GameState): void {
      if (!options.debugEnabled) {
        return;
      }
      const blueView = buildPerspective(state, "blue");
      const redView = buildPerspective(state, "red");
      const blueVisibleCount = blueView.cells.filter((cell) => cell.visible).length;
      const redVisibleCount = redView.cells.filter((cell) => cell.visible).length;
      const blueEnemyVisible = Boolean(blueView.pieces.red);
      const redEnemyVisible = Boolean(redView.pieces.blue);
      const bluePos = coordToKey(state.players.blue.pos);
      const redPos = coordToKey(state.players.red.pos);

      dualViewLineBlue.textContent =
        `\u84dd\u65b9\u89c6\u89d2: \u53ef\u89c1\u683c=${blueVisibleCount} ` +
        `\u654c\u65b9\u53ef\u89c1=${blueEnemyVisible ? "\u662f" : "\u5426"} ` +
        `\u81ea\u8eab=${bluePos}`;
      dualViewLineRed.textContent =
        `\u7ea2\u65b9\u89c6\u89d2: \u53ef\u89c1\u683c=${redVisibleCount} ` +
        `\u654c\u65b9\u53ef\u89c1=${redEnemyVisible ? "\u662f" : "\u5426"} ` +
        `\u81ea\u8eab=${redPos}`;
    },
  };
}
