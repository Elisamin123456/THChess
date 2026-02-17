import { applyCommandEnvelope, buildPerspective, createInitialState } from "./game";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COL_LABELS,
  Command,
  CommandEnvelope,
  Coord,
  GameState,
  RoleSkillId,
  Side,
  coordsEqual,
  keyToCoord,
} from "./protocol";

const REPLAY_MAGIC = "RPY1";

type PackedStats = [number, number, number, number, number, number, number];

interface ReplayInitialStats {
  blue: PackedStats;
  red: PackedStats;
}

interface ParsedReplay {
  initialStats: ReplayInitialStats | null;
  commands: CommandEnvelope[];
}

const TYPE_TO_CODE: Record<Command["type"], string> = {
  move: "m",
  build: "b",
  scout: "s",
  attack: "a",
  endTurn: "e",
  unlockSkill: "u",
  needle: "n",
  amulet: "h",
  orb: "o",
  blink: "l",
};

const CODE_TO_TYPE: Record<string, Command["type"]> = {
  m: "move",
  b: "build",
  s: "scout",
  a: "attack",
  e: "endTurn",
  u: "unlockSkill",
  n: "needle",
  h: "amulet",
  o: "orb",
  l: "blink",
};

function sideToCode(side: Side): string {
  return side === "blue" ? "b" : "r";
}

function codeToSide(code: string): Side {
  if (code === "b") {
    return "blue";
  }
  if (code === "r") {
    return "red";
  }
  throw new Error(`invalid side code: ${code}`);
}

function skillToCode(skill: RoleSkillId): string {
  switch (skill) {
    case "role1":
      return "1";
    case "role2":
      return "2";
    case "role3":
      return "3";
    case "role4":
      return "4";
    default:
      return "0";
  }
}

function codeToSkill(code: string): RoleSkillId {
  switch (code) {
    case "1":
      return "role1";
    case "2":
      return "role2";
    case "3":
      return "role3";
    case "4":
      return "role4";
    default:
      throw new Error(`invalid skill code: ${code}`);
  }
}

function parseIntStrict(value: string, fieldName: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`invalid ${fieldName}: ${value}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

function encodeCommand(envelope: CommandEnvelope): string {
  const seq = String(envelope.seq);
  const code = TYPE_TO_CODE[envelope.command.type];
  const actor = sideToCode(envelope.command.actor);

  switch (envelope.command.type) {
    case "move":
    case "attack":
    case "amulet":
      return [seq, code, actor, envelope.command.to].join(",");
    case "build":
    case "needle":
    case "blink":
      return [seq, code, actor, envelope.command.to, String(envelope.command.spirit)].join(",");
    case "scout":
    case "endTurn":
      return [seq, code, actor].join(",");
    case "orb":
      return [seq, code, actor, String(envelope.command.spirit)].join(",");
    case "unlockSkill":
      return [seq, code, actor, skillToCode(envelope.command.skill)].join(",");
    default:
      throw new Error("unsupported command");
  }
}

function decodeCommand(line: string): CommandEnvelope {
  const parts = line.split(",");
  if (parts.length < 3) {
    throw new Error(`invalid replay line: ${line}`);
  }

  const seq = parseIntStrict(parts[0], "seq");
  const type = CODE_TO_TYPE[parts[1]];
  if (!type) {
    throw new Error(`invalid command type code: ${parts[1]}`);
  }
  const actor = codeToSide(parts[2]);

  let command: Command;
  switch (type) {
    case "move":
    case "attack":
    case "amulet": {
      const to = parts[3];
      if (!to || !keyToCoord(to)) {
        throw new Error(`invalid target coordinate: ${to ?? ""}`);
      }
      if (type === "move") {
        command = { type, actor, to };
      } else if (type === "attack") {
        command = { type, actor, to };
      } else {
        command = { type, actor, to, spirit: 1 };
      }
      break;
    }
    case "build":
    case "needle":
    case "blink": {
      const to = parts[3];
      const spiritRaw = parts[4] ?? "";
      if (!to || !keyToCoord(to)) {
        throw new Error(`invalid target coordinate: ${to ?? ""}`);
      }
      const spirit = parseIntStrict(spiritRaw, "spirit");
      command = { type, actor, to, spirit };
      break;
    }
    case "scout":
      command = { type, actor };
      break;
    case "endTurn":
      command = { type, actor };
      break;
    case "orb": {
      const spirit = parseIntStrict(parts[3] ?? "", "spirit");
      command = { type, actor, spirit };
      break;
    }
    case "unlockSkill": {
      const skill = codeToSkill(parts[3] ?? "");
      command = { type, actor, skill };
      break;
    }
    default:
      throw new Error("unsupported command");
  }

  return {
    kind: "command",
    seq,
    command,
  };
}

function packStats(state: GameState, side: Side): PackedStats {
  const stats = state.players[side].stats;
  return [
    stats.hp,
    stats.spirit,
    stats.maxSpirit,
    stats.atk,
    stats.vision,
    stats.moveRange,
    stats.gold,
  ];
}

function unpackStats(base: GameState, side: Side, packed: PackedStats): void {
  const stats = base.players[side].stats;
  stats.hp = packed[0];
  stats.spirit = packed[1];
  stats.maxSpirit = packed[2];
  stats.atk = packed[3];
  stats.vision = packed[4];
  stats.moveRange = packed[5];
  stats.gold = packed[6];
}

function encodeInitialStats(state: GameState): string {
  const values = [...packStats(state, "blue"), ...packStats(state, "red")];
  return `I,${values.join(",")}`;
}

function decodeInitialStats(line: string): ReplayInitialStats {
  const parts = line.split(",");
  if (parts.length !== 15 || parts[0] !== "I") {
    throw new Error("invalid replay initial stats line");
  }
  const values = parts.slice(1).map((value) => parseIntStrict(value, "initial stat"));
  const blue = values.slice(0, 7) as PackedStats;
  const red = values.slice(7, 14) as PackedStats;
  return { blue, red };
}

export function serializeReplay(envelopes: CommandEnvelope[], initialState: GameState): string {
  const lines: string[] = [REPLAY_MAGIC, encodeInitialStats(initialState)];
  for (const envelope of envelopes) {
    lines.push(encodeCommand(envelope));
  }
  return lines.join("\n");
}

export function deserializeReplay(content: string): ParsedReplay {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || lines[0] !== REPLAY_MAGIC) {
    throw new Error("invalid replay header");
  }

  let initialStats: ReplayInitialStats | null = null;
  let index = 1;
  if (lines[index]?.startsWith("I,")) {
    initialStats = decodeInitialStats(lines[index]);
    index += 1;
  }

  const commands: CommandEnvelope[] = [];
  for (let i = index; i < lines.length; i += 1) {
    commands.push(decodeCommand(lines[i]));
  }
  return { initialStats, commands };
}

export function buildReplayFilename(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [
    "thchess",
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  ].join("-") + ".rpy";
}

function buildReplayStates(parsed: ParsedReplay): GameState[] {
  const first = createInitialState();
  if (parsed.initialStats) {
    unpackStats(first, "blue", parsed.initialStats.blue);
    unpackStats(first, "red", parsed.initialStats.red);
  }

  const states: GameState[] = [first];
  for (const envelope of parsed.commands) {
    const prev = states[states.length - 1];
    const applied = applyCommandEnvelope(prev, envelope);
    if (!applied.ok) {
      throw new Error(`seq=${envelope.seq} replay apply failed: ${applied.reason}`);
    }
    states.push(applied.state);
  }
  return states;
}

function terrainChar(terrain: string): string {
  switch (terrain) {
    case "grass":
      return ",";
    case "spawnBlue":
      return "B";
    case "spawnRed":
      return "R";
    default:
      return ".";
  }
}

function pieceAt(coord: Coord, side: Side, state: GameState): boolean {
  return coordsEqual(state.players[side].pos, coord);
}

function renderPerspectiveBoard(state: GameState, side: Side): string {
  const perspective = buildPerspective(state, side);
  const lines: string[] = [];
  lines.push(`    ${COL_LABELS.join(" ")}`);

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    let row = `${String(y + 1).padStart(2, " ")}  `;
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const cell = perspective.cells[y * BOARD_WIDTH + x];
      let ch = terrainChar(cell.terrain);
      if (!cell.visible) {
        ch = "?";
      } else if (pieceAt(cell.coord, "blue", state)) {
        ch = "1";
      } else if (pieceAt(cell.coord, "red", state)) {
        ch = "2";
      } else if (cell.hasWall) {
        ch = "#";
      }
      row += ch;
      if (x < BOARD_WIDTH - 1) {
        row += " ";
      }
    }
    lines.push(row);
  }

  lines.push("图例: 1=P1 2=P2 #=墙 ,=草 ?=战争迷雾");
  return lines.join("\n");
}

function actionText(command: Command): string {
  const toDisplay = (key: string): string => {
    const coord = keyToCoord(key);
    return coord ? `${COL_LABELS[coord.x]}:${coord.y + 1}` : key;
  };
  switch (command.type) {
    case "move":
      return `移动 -> ${toDisplay(command.to)}`;
    case "build":
      return `建造 -> ${toDisplay(command.to)} (灵力${command.spirit})`;
    case "scout":
      return "侦察";
    case "attack":
      return `普攻 -> ${toDisplay(command.to)}`;
    case "needle":
      return `封魔针 -> ${toDisplay(command.to)} (灵力${command.spirit})`;
    case "amulet":
      return `符札 -> ${toDisplay(command.to)}`;
    case "orb":
      return `阴阳玉 (灵力${command.spirit})`;
    case "blink":
      return `闪现 -> ${toDisplay(command.to)} (灵力${command.spirit})`;
    case "unlockSkill":
      return `解锁${command.skill}`;
    case "endTurn":
      return "空过";
    default:
      return command.type;
  }
}

export function bootstrapReplayPage(appRoot: HTMLElement, debugRoot: HTMLElement): void {
  appRoot.innerHTML = "";
  debugRoot.innerHTML = "";
  debugRoot.style.display = "none";

  const shell = document.createElement("section");
  shell.className = "replay-shell";

  const title = document.createElement("h2");
  title.textContent = "THChess Replay";
  title.style.margin = "0";
  shell.appendChild(title);

  const toolbar = document.createElement("div");
  toolbar.className = "replay-toolbar";
  shell.appendChild(toolbar);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".rpy,text/plain";
  toolbar.appendChild(fileInput);

  const controls = document.createElement("div");
  controls.className = "replay-controls";
  toolbar.appendChild(controls);

  const prevBtn = document.createElement("button");
  prevBtn.className = "debug-btn";
  prevBtn.textContent = "上一步";
  controls.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "debug-btn";
  nextBtn.textContent = "下一步";
  controls.appendChild(nextBtn);

  const stepRange = document.createElement("input");
  stepRange.type = "range";
  stepRange.min = "0";
  stepRange.max = "0";
  stepRange.value = "0";
  stepRange.style.width = "220px";
  controls.appendChild(stepRange);

  const stepLabel = document.createElement("span");
  stepLabel.className = "replay-info";
  stepLabel.textContent = "步数 0/0";
  toolbar.appendChild(stepLabel);

  const info = document.createElement("div");
  info.className = "replay-info";
  info.textContent = "请选择 .rpy 文件";
  shell.appendChild(info);

  const panels = document.createElement("div");
  panels.className = "replay-panels";
  shell.appendChild(panels);

  const bluePanel = document.createElement("section");
  bluePanel.className = "replay-panel";
  panels.appendChild(bluePanel);

  const blueTitle = document.createElement("h3");
  blueTitle.className = "panel-title";
  blueTitle.style.borderBottom = "none";
  blueTitle.style.padding = "0 0 6px 0";
  blueTitle.textContent = "P1 蓝方视角";
  bluePanel.appendChild(blueTitle);

  const blueBoard = document.createElement("pre");
  blueBoard.className = "replay-board";
  bluePanel.appendChild(blueBoard);

  const redPanel = document.createElement("section");
  redPanel.className = "replay-panel";
  panels.appendChild(redPanel);

  const redTitle = document.createElement("h3");
  redTitle.className = "panel-title";
  redTitle.style.borderBottom = "none";
  redTitle.style.padding = "0 0 6px 0";
  redTitle.textContent = "P2 红方视角";
  redPanel.appendChild(redTitle);

  const redBoard = document.createElement("pre");
  redBoard.className = "replay-board";
  redPanel.appendChild(redBoard);

  const announcePanel = document.createElement("section");
  announcePanel.className = "panel announcement-panel";
  shell.appendChild(announcePanel);

  const announceTitle = document.createElement("h3");
  announceTitle.className = "panel-title";
  announceTitle.textContent = "公告记录";
  announcePanel.appendChild(announceTitle);

  const announceList = document.createElement("div");
  announceList.className = "announcement-list";
  announcePanel.appendChild(announceList);

  appRoot.appendChild(shell);

  let commands: CommandEnvelope[] = [];
  let states: GameState[] = [createInitialState()];
  let step = 0;

  const render = (): void => {
    if (states.length === 0) {
      return;
    }

    if (step < 0) {
      step = 0;
    }
    if (step >= states.length) {
      step = states.length - 1;
    }

    const state = states[step];
    stepLabel.textContent = `步数 ${step}/${Math.max(0, states.length - 1)}`;
    stepRange.max = String(Math.max(0, states.length - 1));
    stepRange.value = String(step);
    prevBtn.disabled = step <= 0;
    nextBtn.disabled = step >= states.length - 1;

    const commandText = step > 0 ? actionText(commands[step - 1].command) : "初始局面";
    info.textContent =
      `seq=${state.seq} | 回合=${state.turn.round} | 当前=${state.turn.side === "blue" ? "P1" : "P2"} | ` +
      `操作=${commandText}` +
      (state.winner ? ` | 赢家=${state.winner === "blue" ? "P1 蓝方" : "P2 红方"}` : "");

    blueBoard.textContent = renderPerspectiveBoard(state, "blue");
    redBoard.textContent = renderPerspectiveBoard(state, "red");

    announceList.innerHTML = "";
    const history = [...state.announcements].reverse();
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "announcement-item";
      empty.textContent = "暂无公告";
      announceList.appendChild(empty);
    } else {
      for (const entry of history) {
        const item = document.createElement("div");
        item.className = "announcement-item";
        const sideMatch = entry.match(/^\[回合\d+P([12]):/);
        if (sideMatch?.[1] === "1") {
          item.classList.add("announcement-blue");
        } else if (sideMatch?.[1] === "2") {
          item.classList.add("announcement-red");
        }
        item.textContent = entry;
        announceList.appendChild(item);
      }
    }
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = deserializeReplay(content);
      commands = parsed.commands;
      states = buildReplayStates(parsed);
      step = states.length - 1;
      render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      info.textContent = `回放文件解析失败: ${message}`;
      commands = [];
      states = [createInitialState()];
      step = 0;
      render();
    }
  });

  prevBtn.addEventListener("click", () => {
    step -= 1;
    render();
  });

  nextBtn.addEventListener("click", () => {
    step += 1;
    render();
  });

  stepRange.addEventListener("input", () => {
    step = Number(stepRange.value);
    render();
  });

  render();
}
