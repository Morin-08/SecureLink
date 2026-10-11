const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "app.html"));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let activeCode = null;
let activeSenderId = null;
let senderSocket = null;

// --- Rate limiting: new connections per IP ---
const CONNECTION_LIMIT = 10; // max new connections per IP
const CONNECTION_WINDOW_MS = 60000; // per 1 minute
const connectionCounts = new Map(); // ip -> { count, windowStart }

// --- Rate limiting: pairing-code verification attempts ---
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function generateSenderId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = connectionCounts.get(ip);

  if (!entry || now - entry.windowStart > CONNECTION_WINDOW_MS) {
    connectionCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > CONNECTION_LIMIT) {
    return true;
  }
  return false;
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    console.log(`Rate limit exceeded for ${ip} — connection rejected`);
    ws.close(1008, "Rate limit exceeded. Please try again later.");
    return;
  }

  console.log("A client connected");
  ws.isVerified = false;
  ws.verifyAttempts = 0;

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === "start-pairing") {
      activeCode = generateCode();
      activeSenderId = generateSenderId();
      senderSocket = ws;
      ws.isVerified = true;
      ws.send(
        JSON.stringify({
          type: "pairing-code",
          code: activeCode,
          senderId: activeSenderId,
        }),
      );
      console.log(
        "New pairing code generated:",
        activeCode,
        "| Sender ID:",
        activeSenderId,
      );
      return;
    }

    if (data.type === "verify-code") {
      if (ws.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
        ws.send(
          JSON.stringify({
            type: "verified",
            success: false,
            rateLimited: true,
          }),
        );
        console.log(
          `Too many failed verification attempts from ${ip} — closing connection`,
        );
        ws.close(
          1008,
          "Too many failed attempts. Please reconnect and try again.",
        );
        return;
      }

      if (data.code === activeCode) {
        ws.isVerified = true;
        ws.deviceName = data.deviceName || "Unnamed device";
        ws.send(
          JSON.stringify({
            type: "verified",
            success: true,
            senderId: activeSenderId,
          }),
        );
        console.log("A receiver verified successfully:", ws.deviceName);

        if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
          senderSocket.send(
            JSON.stringify({
              type: "peer-connected",
              deviceName: ws.deviceName,
            }),
          );
        }
      } else {
        ws.verifyAttempts += 1;
        ws.send(JSON.stringify({ type: "verified", success: false }));
        console.log(
          `A receiver entered the wrong code (attempt ${ws.verifyAttempts}/${MAX_VERIFY_ATTEMPTS})`,
        );
      }
      return;
    }

    if (data.type === "file") {
      if (!ws.isVerified) {
        console.log("Blocked file from unverified client");
        return;
      }
      console.log(
        `Relaying encrypted file: ${data.filename} (${data.data.length} bytes, base64)`,
      );
      wss.clients.forEach((client) => {
        if (
          client !== ws &&
          client.readyState === WebSocket.OPEN &&
          client.isVerified
        ) {
          client.send(
            JSON.stringify({
              type: "file",
              filename: data.filename,
              data: data.data,
              iv: data.iv,
              hash: data.hash,
            }),
          );
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("A client disconnected");
    if (ws === senderSocket) senderSocket = null;
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});