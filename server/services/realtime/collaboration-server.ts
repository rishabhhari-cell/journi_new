import { Buffer } from "node:buffer";
import { URL } from "node:url";
import type { Server as HttpServer } from "node:http";
import * as Y from "yjs";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { assertManuscriptAccess } from "../../lib/access";
import { logger } from "../../lib/logger";
import { supabaseAdmin } from "../../lib/supabase";
import { env } from "../../config/env";

type IncomingMessage =
  | {
      type: "join";
      manuscriptId: string;
    }
  | {
      type: "doc_update";
      manuscriptId: string;
      update: string;
    }
  | {
      type: "presence";
      manuscriptId: string;
      state: Record<string, unknown>;
    }
  | {
      type: "comments";
      manuscriptId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "ping";
    };

type OutgoingMessage =
  | {
      type: "init";
      manuscriptId: string;
      snapshot: string;
      presence: Array<Record<string, unknown>>;
    }
  | {
      type: "doc_update";
      manuscriptId: string;
      update: string;
      fromUserId: string;
    }
  | {
      type: "presence";
      manuscriptId: string;
      users: Array<Record<string, unknown>>;
    }
  | {
      type: "comments";
      manuscriptId: string;
      payload: Record<string, unknown>;
      fromUserId: string;
    }
  | {
      type: "pong";
    }
  | {
      type: "error";
      message: string;
      code: string;
    };

interface SocketContext {
  userId: string;
  email: string;
  fullName: string;
  initials: string;
  manuscriptId?: string;
}

interface CollaborationSocket extends WebSocket {
  ctx?: SocketContext;
}

interface Room {
  doc: Y.Doc;
  clients: Set<CollaborationSocket>;
  presence: Map<string, Record<string, unknown>>;
  loaded: boolean;
  saveTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, Room>();

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function send(socket: CollaborationSocket, message: OutgoingMessage) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function broadcast(room: Room, message: OutgoingMessage, exclude?: CollaborationSocket) {
  for (const client of room.clients) {
    if (exclude && client === exclude) continue;
    send(client, message);
  }
}

async function loadLatestSnapshot(manuscriptId: string, room: Room) {
  if (room.loaded) return;
  const { data, error } = await supabaseAdmin
    .from("manuscript_versions")
    .select("snapshot_base64")
    .eq("manuscript_id", manuscriptId)
    .eq("version_label", "realtime_snapshot")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data?.snapshot_base64) {
    try {
      const update = Buffer.from(data.snapshot_base64, "base64");
      Y.applyUpdate(room.doc, update);
    } catch (snapshotError) {
      logger.warn("Failed to apply Yjs snapshot", {
        manuscriptId,
        error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
      });
    }
  }

  room.loaded = true;
}

async function persistSnapshot(manuscriptId: string, room: Room, actorUserId?: string) {
  const snapshot = Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString("base64");
  const { error } = await supabaseAdmin.from("manuscript_versions").insert({
    manuscript_id: manuscriptId,
    version_label: "realtime_snapshot",
    snapshot_base64: snapshot,
    created_by: actorUserId ?? null,
  });

  if (error) {
    logger.warn("Failed to persist Yjs snapshot", {
      manuscriptId,
      error: error.message,
    });
  }
}

function scheduleSnapshot(manuscriptId: string, room: Room, actorUserId?: string) {
  if (room.saveTimer) {
    clearTimeout(room.saveTimer);
  }
  room.saveTimer = setTimeout(() => {
    void persistSnapshot(manuscriptId, room, actorUserId);
    room.saveTimer = null;
  }, env.WS_SNAPSHOT_DEBOUNCE_MS);
}

function getOrCreateRoom(manuscriptId: string): Room {
  let room = rooms.get(manuscriptId);
  if (room) return room;
  room = {
    doc: new Y.Doc(),
    clients: new Set<CollaborationSocket>(),
    presence: new Map<string, Record<string, unknown>>(),
    loaded: false,
    saveTimer: null,
  };
  rooms.set(manuscriptId, room);
  return room;
}

async function authenticateSocket(reqUrl: string) {
  const url = new URL(reqUrl, env.APP_BASE_URL);
  const token = url.searchParams.get("token");
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, initials")
    .eq("id", data.user.id)
    .maybeSingle();

  const fullName = profile?.full_name ?? data.user.user_metadata?.full_name ?? data.user.email ?? "User";
  const initials = profile?.initials ?? initialsOf(fullName);

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    fullName,
    initials,
  };
}

function parseMessage(raw: RawData): IncomingMessage | null {
  try {
    const normalized =
      typeof raw === "string"
        ? raw
        : raw instanceof Buffer
          ? raw.toString("utf8")
          : Buffer.from(raw as ArrayBuffer).toString("utf8");
    const payload = JSON.parse(normalized);
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      return null;
    }
    return payload as IncomingMessage;
  } catch {
    return null;
  }
}

export function initCollaborationServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/collab",
  });

  wss.on("connection", async (socket: CollaborationSocket, req) => {
    const auth = await authenticateSocket(req.url ?? "");
    if (!auth) {
      send(socket, {
        type: "error",
        message: "Unauthorized websocket connection",
        code: "WS_AUTH_FAILED",
      });
      socket.close();
      return;
    }

    socket.ctx = auth;
    send(socket, { type: "pong" });

    socket.on("message", async (raw) => {
      const message = parseMessage(raw);
      if (!message) {
        send(socket, { type: "error", code: "WS_INVALID_MESSAGE", message: "Invalid message payload" });
        return;
      }

      if (!socket.ctx) return;
      if (message.type === "ping") {
        send(socket, { type: "pong" });
        return;
      }

      if (message.type === "join") {
        try {
          await assertManuscriptAccess(socket.ctx.userId, message.manuscriptId, false);
        } catch {
          send(socket, { type: "error", code: "WS_ACCESS_DENIED", message: "Manuscript access denied" });
          return;
        }

        const room = getOrCreateRoom(message.manuscriptId);
        await loadLatestSnapshot(message.manuscriptId, room);
        room.clients.add(socket);
        socket.ctx.manuscriptId = message.manuscriptId;
        room.presence.set(socket.ctx.userId, {
          userId: socket.ctx.userId,
          fullName: socket.ctx.fullName,
          initials: socket.ctx.initials,
          updatedAt: new Date().toISOString(),
        });

        send(socket, {
          type: "init",
          manuscriptId: message.manuscriptId,
          snapshot: Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString("base64"),
          presence: Array.from(room.presence.values()),
        });
        broadcast(
          room,
          {
            type: "presence",
            manuscriptId: message.manuscriptId,
            users: Array.from(room.presence.values()),
          },
          socket,
        );
        return;
      }

      const manuscriptId = message.manuscriptId;
      const room = rooms.get(manuscriptId);
      if (!room || socket.ctx.manuscriptId !== manuscriptId) {
        send(socket, { type: "error", code: "WS_NOT_JOINED", message: "Join manuscript room first" });
        return;
      }

      if (message.type === "doc_update") {
        const update = Buffer.from(message.update, "base64");
        Y.applyUpdate(room.doc, update);
        scheduleSnapshot(manuscriptId, room, socket.ctx.userId);
        broadcast(room, {
          type: "doc_update",
          manuscriptId,
          update: message.update,
          fromUserId: socket.ctx.userId,
        }, socket);
        return;
      }

      if (message.type === "presence") {
        room.presence.set(socket.ctx.userId, {
          userId: socket.ctx.userId,
          fullName: socket.ctx.fullName,
          initials: socket.ctx.initials,
          ...message.state,
          updatedAt: new Date().toISOString(),
        });
        broadcast(room, {
          type: "presence",
          manuscriptId,
          users: Array.from(room.presence.values()),
        });
        return;
      }

      if (message.type === "comments") {
        broadcast(room, {
          type: "comments",
          manuscriptId,
          payload: message.payload,
          fromUserId: socket.ctx.userId,
        }, socket);
      }
    });

    socket.on("close", async () => {
      if (!socket.ctx?.manuscriptId) return;
      const manuscriptId = socket.ctx.manuscriptId;
      const room = rooms.get(manuscriptId);
      if (!room) return;

      room.clients.delete(socket);
      room.presence.delete(socket.ctx.userId);
      broadcast(room, {
        type: "presence",
        manuscriptId,
        users: Array.from(room.presence.values()),
      });

      if (room.clients.size === 0) {
        await persistSnapshot(manuscriptId, room, socket.ctx.userId);
        rooms.delete(manuscriptId);
      }
    });
  });

  logger.info("Realtime collaboration server initialized", {
    path: "/ws/collab",
  });
}
