import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface Player {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  weapon: "pistol" | "shotgun" | "smg" | "m16" | "magnum" | "sniper" | "wonder_weapon";
  health: number;
  points: number;
  kills: number;
  isADS: boolean;
  isReloading: boolean;
  isDowned: boolean;
  isReviving: string | null; // target player id
}

interface Room {
  id: string;
  name: string;
  hostId: string;
  gameState: "lobby" | "playing" | "gameover";
  currentRound: number;
  players: { [id: string]: Player };
}

const rooms: { [id: string]: Room } = {};

// Keep track of socket connection -> room/client mappings
const clients = new Map<WebSocket, { roomId: string; clientId: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade manually to hook up cleanly with Express routing if needed
  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/ws") || request.url?.includes("socket")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // Allow Vite to handle HMR upgrades or fallback
      if (process.env.NODE_ENV !== "production") {
        // Vite dev server handles its own HMR upgrade, but since we run client HMR disabled, we can still defer if needed
      }
    }
  });

  // REST API Endpoint for active rooms listing
  app.get("/api/rooms", (req, res) => {
    const list = Object.values(rooms).map((r) => ({
      id: r.id,
      name: r.name,
      gameState: r.gameState,
      playerCount: Object.keys(r.players).length,
      currentRound: r.currentRound,
    }));
    res.json(list);
  });

  wss.on("connection", (ws) => {
    console.log("Client connected via WebSocket");

    ws.on("message", (messageStr: string) => {
      try {
        const data = JSON.parse(messageStr);
        const { type } = data;

        if (type === "join-room") {
          const { roomId, roomName, clientId, playerName, playerColor } = data;
          
          let room = rooms[roomId];
          if (!room) {
            room = {
              id: roomId,
              name: roomName || `Detention Match ${roomId.substring(0, 4).toUpperCase()}`,
              hostId: clientId,
              gameState: "lobby",
              currentRound: 1,
              players: {},
            };
            rooms[roomId] = room;
            console.log(`Created room: ${room.name} (${roomId})`);
          }

          // Setup player info
          const player: Player = {
            id: clientId,
            name: playerName || `Survivor ${Math.floor(Math.random() * 1000)}`,
            color: playerColor || 0xf97316,
            x: 0,
            y: 0,
            z: 0,
            rx: 0,
            ry: 0,
            rz: 0,
            weapon: "pistol",
            health: 100,
            points: 500,
            kills: 0,
            isADS: false,
            isReloading: false,
            isDowned: false,
            isReviving: null,
          };

          room.players[clientId] = player;
          clients.set(ws, { roomId, clientId });

          // If no active host or host left, assign host to this client
          if (!room.hostId || !room.players[room.hostId]) {
            room.hostId = clientId;
          }

          console.log(`Client ${player.name} (${clientId}) joined room ${roomId}`);

          // Broadcast room state to all players in the room
          broadcastToRoom(roomId, {
            type: "room-state",
            room,
          });

          // Post a system message to chat
          broadcastToRoom(roomId, {
            type: "chat-message",
            sender: "SYSTEM",
            text: `${player.name.toUpperCase()} ACCESSED THE COMM CHANNEL.`,
            timestamp: Date.now(),
          });

        } else if (type === "player-update") {
          const mapping = clients.get(ws);
          if (mapping) {
            const { roomId, clientId } = mapping;
            const room = rooms[roomId];
            if (room && room.players[clientId]) {
              const player = room.players[clientId];
              // Update position and other variables
              player.x = data.x ?? player.x;
              player.y = data.y ?? player.y;
              player.z = data.z ?? player.z;
              player.rx = data.rx ?? player.rx;
              player.ry = data.ry ?? player.ry;
              player.rz = data.rz ?? player.rz;
              player.weapon = data.weapon ?? player.weapon;
              player.health = data.health ?? player.health;
              player.points = data.points ?? player.points;
              player.kills = data.kills ?? player.kills;
              player.isADS = data.isADS ?? player.isADS;
              player.isReloading = data.isReloading ?? player.isReloading;
              player.isDowned = data.isDowned ?? player.isDowned;
              player.isReviving = data.isReviving ?? player.isReviving;

              // Broadcast player updates to all client peers in room (exclude self to save bandwidth)
              broadcastToRoom(roomId, {
                type: "player-update",
                clientId,
                player,
              }, ws);
            }
          }

        } else if (type === "player-shoot") {
          const mapping = clients.get(ws);
          if (mapping) {
            broadcastToRoom(mapping.roomId, {
              type: "player-shoot",
              clientId: mapping.clientId,
              wpnId: data.wpnId,
            }, ws);
          }

        } else if (type === "zombie-spawn") {
          const mapping = clients.get(ws);
          if (mapping) {
            broadcastToRoom(mapping.roomId, {
              type: "zombie-spawn",
              zombie: data.zombie,
            }, ws);
          }

        } else if (type === "zombie-damage") {
          const mapping = clients.get(ws);
          if (mapping) {
            broadcastToRoom(mapping.roomId, {
              type: "zombie-damage",
              zombieId: data.zombieId,
              damage: data.damage,
              killerId: mapping.clientId,
              isFatal: data.isFatal,
            });
          }

        } else if (type === "zombie-deal-damage") {
          const mapping = clients.get(ws);
          if (mapping) {
            broadcastToRoom(mapping.roomId, {
              type: "zombie-deal-damage",
              zombieId: data.zombieId,
              targetId: data.targetId,
              damage: data.damage,
            });
          }

        } else if (type === "chat-message") {
          const mapping = clients.get(ws);
          if (mapping) {
            const room = rooms[mapping.roomId];
            const senderName = room?.players[mapping.clientId]?.name || "Unknown";
            broadcastToRoom(mapping.roomId, {
              type: "chat-message",
              sender: senderName,
              text: data.text,
              timestamp: Date.now(),
            });
          }

        } else if (type === "start-match") {
          const mapping = clients.get(ws);
          if (mapping) {
            const room = rooms[mapping.roomId];
            if (room && room.hostId === mapping.clientId) {
              room.gameState = "playing";
              room.currentRound = 1;
              
              // Reset all player stats on new match
              for (const pid in room.players) {
                const p = room.players[pid];
                p.health = 100;
                p.points = 500;
                p.kills = 0;
                p.weapon = "pistol";
                p.isDowned = false;
                p.isReloading = false;
                p.isADS = false;
                p.isReviving = null;
                p.x = 0;
                p.y = 0;
                p.z = 0;
                p.rx = 0;
                p.ry = 0;
                p.rz = 0;
              }

              broadcastToRoom(mapping.roomId, {
                type: "start-match",
              });
              
              // Sync room state to clear client metrics
              broadcastToRoom(mapping.roomId, {
                type: "room-state",
                room,
              });
            }
          }

        } else if (type === "round-start") {
          const mapping = clients.get(ws);
          if (mapping) {
            const room = rooms[mapping.roomId];
            if (room) {
              room.currentRound = data.round;
              broadcastToRoom(mapping.roomId, {
                type: "round-start",
                round: data.round,
              }, ws);
            }
          }

        } else if (type === "sync-state") {
          const mapping = clients.get(ws);
          if (mapping) {
            broadcastToRoom(mapping.roomId, {
              type: "sync-state",
              zombies: data.zombies,
              currentRound: data.currentRound,
            }, ws);
          }
        }

      } catch (err) {
        console.error("Failed to process socket message:", err);
      }
    });

    ws.on("close", () => {
      const mapping = clients.get(ws);
      if (mapping) {
        const { roomId, clientId } = mapping;
        clients.delete(ws);

        const room = rooms[roomId];
        if (room) {
          const player = room.players[clientId];
          const name = player?.name || "Survivor";

          // Delete player from room
          delete room.players[clientId];

          console.log(`Client ${name} (${clientId}) left room ${roomId}`);

          // Sync remaining players
          const remainingIds = Object.keys(room.players);
          if (remainingIds.length === 0) {
            delete rooms[roomId];
            console.log(`Cleaned up empty room ${roomId}`);
          } else {
            // Re-assign host if the host disconnected
            if (room.hostId === clientId) {
              room.hostId = remainingIds[0];
              console.log(`Reassigned host of ${roomId} to client ${room.hostId}`);
            }

            broadcastToRoom(roomId, {
              type: "player-disconnected",
              clientId,
              hostId: room.hostId,
            });

            broadcastToRoom(roomId, {
              type: "chat-message",
              sender: "SYSTEM",
              text: `${name.toUpperCase()} LOST COMM SIGNAL AND LEFT.`,
              timestamp: Date.now(),
            });
          }
        }
      }
    });
  });

  function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
    const msgStr = JSON.stringify(message);
    clients.forEach((mapping, ws) => {
      if (mapping.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    });
  }

  // Vite development middleware or static asset hosting
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
