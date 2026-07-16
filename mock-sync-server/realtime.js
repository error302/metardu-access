/**
 * WebSocket server for real-time collaboration.
 *
 * Mounts on the same HTTP server (upgrade handling).
 * Broadcasts presence + capture events to all connected clients.
 *
 * Wire protocol: see src/lib/realtime/sync.ts
 */

const WebSocket = require('ws');

const clients = new Map(); // ws -> { surveyorId, projectId, lastSeen }
const presenceByProject = new Map(); // projectId -> Map(surveyorId -> presence)

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server, path: '/realtime' });

  wss.on('connection', (ws, req) => {
    console.log(`[ws] Client connected (total: ${wss.clients.size})`);
    let clientInfo = { surveyorId: null, surveyorName: null, projectId: null, lastSeen: Date.now() };
    clients.set(ws, clientInfo);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        clientInfo.lastSeen = Date.now();

        switch (data.type) {
          case 'presence':
            handlePresence(ws, data);
            break;
          case 'capture':
            handleCapture(ws, data);
            break;
          case 'heartbeat':
            // Just update lastSeen
            break;
          case 'sync':
            handleSync(ws, data);
            break;
          default:
            console.log('[ws] Unknown message type:', data.type);
        }
      } catch (err) {
        console.warn('[ws] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[ws] Client disconnected (total: ${wss.clients.size})`);
      const info = clients.get(ws);
      if (info && info.surveyorId) {
        // Mark as offline in presence list
        broadcastPresenceUpdate({
          surveyorId: info.surveyorId,
          surveyorName: info.surveyorName,
          status: 'offline',
          lastSeenAt: new Date().toISOString(),
        }, info.projectId);
      }
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[ws] Client error:', err.message);
    });
  });

  // Heartbeat check every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [ws, info] of clients.entries()) {
      if (now - info.lastSeen > 90_000) {
        console.log('[ws] Terminating stale client');
        ws.terminate();
        clients.delete(ws);
      }
    }
  }, 60_000);

  console.log('[ws] WebSocket server ready on /realtime');
}

function handlePresence(ws, data) {
  const info = clients.get(ws);
  if (!info) return;

  info.surveyorId = data.surveyorId;
  info.surveyorName = data.surveyorName;
  info.projectId = data.projectId;

  // Store presence
  if (data.projectId) {
    if (!presenceByProject.has(data.projectId)) {
      presenceByProject.set(data.projectId, new Map());
    }
    presenceByProject.get(data.projectId).set(data.surveyorId, {
      surveyorId: data.surveyorId,
      surveyorName: data.surveyorName,
      surveyorLicense: data.surveyorLicense,
      projectId: data.projectId,
      status: data.status,
      lastSeenAt: data.lastSeenAt,
      lat: data.lat,
      lng: data.lng,
    });
  }

  // Broadcast presence update to all clients on same project
  broadcastPresenceUpdate({
    surveyorId: data.surveyorId,
    surveyorName: data.surveyorName,
    surveyorLicense: data.surveyorLicense,
    projectId: data.projectId,
    status: data.status,
    lastSeenAt: data.lastSeenAt,
    lat: data.lat,
    lng: data.lng,
  }, data.projectId);

  // Send full presence list back to this client
  const projectPresence = data.projectId
    ? Array.from(presenceByProject.get(data.projectId)?.values() ?? [])
    : [];
  ws.send(JSON.stringify({ type: 'presence-list', data: projectPresence }));

  // Acknowledge
  ws.send(JSON.stringify({ type: 'ack', eventId: 'presence-' + Date.now() }));
}

function handleCapture(ws, data) {
  const info = clients.get(ws);
  if (!info) return;

  const captureEvent = data.data || data;

  // Broadcast to all clients on the same project (except sender)
  const message = JSON.stringify({
    type: 'capture',
    data: {
      ...captureEvent,
      surveyorId: info.surveyorId,
      surveyorName: info.surveyorName,
    },
  });

  for (const [clientWs, clientInfo] of clients.entries()) {
    if (clientWs !== ws && clientInfo.projectId === info.projectId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }

  // Acknowledge to sender
  ws.send(JSON.stringify({ type: 'ack', eventId: captureEvent.eventId }));
}

function handleSync(ws, data) {
  // Server-side conflict detection (simplified)
  // In production, would check server version vs client version
  ws.send(JSON.stringify({ type: 'ack', eventId: data.eventId }));
}

function broadcastPresenceUpdate(presence, projectId) {
  const message = JSON.stringify({ type: 'presence', ...presence });
  for (const [clientWs, clientInfo] of clients.entries()) {
    if (clientInfo.projectId === projectId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }
}

module.exports = { setupWebSocketServer };
