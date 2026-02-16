import { NetMessage } from "./protocol";

type StatusType = "idle" | "ready" | "connecting" | "connected" | "error" | "closed";

export interface TransportStatus {
  type: StatusType;
  detail: string;
}

export interface ITransport {
  readonly name: string;
  onMessage(handler: (message: NetMessage) => void): void;
  onStatus(handler: (status: TransportStatus) => void): void;
  start(): void;
  connect(remoteId: string): void;
  send(message: NetMessage): void;
  getLocalId(): string;
  dispose(): void;
}

abstract class TransportBase implements ITransport {
  abstract readonly name: string;
  protected messageHandler: ((message: NetMessage) => void) | null = null;
  protected statusHandler: ((status: TransportStatus) => void) | null = null;

  onMessage(handler: (message: NetMessage) => void): void {
    this.messageHandler = handler;
  }

  onStatus(handler: (status: TransportStatus) => void): void {
    this.statusHandler = handler;
  }

  protected emitStatus(type: StatusType, detail: string): void {
    this.statusHandler?.({ type, detail });
  }

  protected emitMessage(message: NetMessage): void {
    this.messageHandler?.(message);
  }

  abstract start(): void;
  abstract connect(remoteId: string): void;
  abstract send(message: NetMessage): void;
  abstract getLocalId(): string;
  abstract dispose(): void;
}

export class LoopbackTransport extends TransportBase {
  readonly name = "loopback";
  private readonly localId = "loopback-local";

  start(): void {
    this.emitStatus("ready", "loopback ready");
  }

  connect(remoteId: string): void {
    this.emitStatus("connected", `loopback connected: ${remoteId || "self"}`);
  }

  send(message: NetMessage): void {
    window.setTimeout(() => {
      this.emitMessage(message);
    }, 0);
  }

  getLocalId(): string {
    return this.localId;
  }

  dispose(): void {
    this.emitStatus("closed", "loopback closed");
  }
}

declare global {
  interface Window {
    Peer?: any;
  }
}

export class PeerJsTransport extends TransportBase {
  readonly name = "peerjs";
  private readonly preferredId: string;
  private peer: any | null = null;
  private connection: any | null = null;
  private localId = "";

  constructor(localPeerId: string) {
    super();
    this.preferredId = localPeerId.trim();
  }

  start(): void {
    const PeerCtor = window.Peer;
    if (!PeerCtor) {
      this.emitStatus("error", "PeerJS not loaded");
      return;
    }

    this.emitStatus("connecting", "creating peer");
    this.peer = this.preferredId ? new PeerCtor(this.preferredId) : new PeerCtor();

    this.peer.on("open", (id: string) => {
      this.localId = id;
      this.emitStatus("ready", `peer ready: ${id}`);
    });

    this.peer.on("connection", (incomingConn: any) => {
      this.attachConnection(incomingConn, true);
    });

    this.peer.on("error", (error: unknown) => {
      this.emitStatus("error", `peer error: ${String(error)}`);
    });

    this.peer.on("disconnected", () => {
      this.emitStatus("error", "peer disconnected");
    });

    this.peer.on("close", () => {
      this.emitStatus("closed", "peer closed");
    });
  }

  connect(remoteId: string): void {
    if (!this.peer) {
      this.emitStatus("error", "start peer first");
      return;
    }
    const target = remoteId.trim();
    if (!target) {
      this.emitStatus("error", "remote id is empty");
      return;
    }
    const conn = this.peer.connect(target, { reliable: true });
    this.attachConnection(conn, false);
  }

  send(message: NetMessage): void {
    if (!this.connection || !this.connection.open) {
      this.emitStatus("error", "connection not open");
      return;
    }
    this.connection.send(message);
  }

  getLocalId(): string {
    return this.localId || this.preferredId;
  }

  dispose(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.emitStatus("closed", "transport disposed");
  }

  private attachConnection(conn: any, incoming: boolean): void {
    if (this.connection && this.connection.open) {
      conn.close();
      this.emitStatus("error", "only one data connection is allowed");
      return;
    }

    this.connection = conn;
    this.emitStatus("connecting", incoming ? "incoming connection" : "connecting to remote");

    conn.on("open", () => {
      this.emitStatus("connected", `connected: ${conn.peer}`);
    });

    conn.on("data", (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        this.emitStatus("error", "invalid message payload");
        return;
      }
      this.emitMessage(payload as NetMessage);
    });

    conn.on("close", () => {
      this.emitStatus("ready", "data channel closed");
      this.connection = null;
    });

    conn.on("error", (error: unknown) => {
      this.emitStatus("error", `connection error: ${String(error)}`);
    });
  }
}

export function createLoopbackTransport(): ITransport {
  return new LoopbackTransport();
}

export function createPeerJsTransport(localPeerId: string): ITransport {
  return new PeerJsTransport(localPeerId);
}

