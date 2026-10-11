# SecureLink — File Sharing Prototype Resistant to MITM Attacks

**Group 4 · IT31S4 · Instructor: Mr. Allan Burgos**

SecureLink is a browser-based file-sharing prototype built to demonstrate resistance to Man-in-the-Middle (MITM) attacks through device pairing and AES-256-GCM encryption — in contrast to baseline vulnerable protocols like SHAREit and plain FTP.

## Features

- **Device pairing** via a server-generated 6-digit code, with an explicit "Verify Device" confirmation step before any file is sent
- **AES-256-GCM encryption** (browser-side, Web Crypto API) — files are encrypted before leaving the sender's browser
- **SHA-256 integrity verification** on every received file
- **Unverified-device blocking** — only paired/verified clients can send or receive
- Built with **React + Tailwind CSS + lucide-react**, bundled locally (esbuild + Tailwind CLI) — runs fully offline, no CDN dependency

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (comes with Node.js)

## Setup

1. Clone the repository:

git clone https://github.com/Morin-08/SecureLink.git
cd SecureLink

2. Install dependencies:

npm install

3. Build the front end (bundles the React app and compiles Tailwind CSS):

npx esbuild src/main.jsx --bundle --outfile=public/app.bundle.js
npx tailwindcss -i ./src/input.css -o ./public/tailwind.output.css

## Running the app

1. Start the server:

node server/index.js

2. Open your browser to:

http://localhost:3000

3. Open a **second** browser tab/window to the same address to act as the second device (Sender + Receiver).

## How to use

1. On one tab, click **Send File** → select a file → this generates a 6-digit pairing code.
2. On the other tab, click **Receive File** → enter the pairing code shown on the sender's screen.
3. Confirm the device on the "Verify Device" screen.
4. The file transfers encrypted; the receiver sees a "🔒 Decrypted · Integrity Verified" confirmation and can download it.

## Project structure

SecureLink/
├── server/
│ └── index.js # Express + WebSocket server (pairing, relay, verification)
├── public/
│ ├── app.html # Main React app entry (loads the local bundle)
│ ├── app.bundle.js # Built React bundle (generated — do not edit directly)
│ ├── tailwind.output.css # Built Tailwind CSS (generated — do not edit directly)
│ ├── home.html, send.html, receive.html # Original vanilla-JS screens (kept as tested fallback)
│ └── send-insecure.html, receive-insecure.html # Deliberately unencrypted baseline demo, used only to capture Wireshark “before” evidence — not part of the secure product
├── src/
│ └── main.jsx # React source for app.html
├── tailwind.config.js
└── package.json

## Security testing performed

- Unauthorized/unverified device blocked
- Wrong pairing code rejected
- Tampered/corrupted file detected via integrity check
- Larger file transfers (images, PDFs) verified
- Wireshark capture comparing plaintext (baseline) vs. encrypted (SecureLink) traffic
- Cisco Packet Tracer simulation of a shared-LAN FTP baseline, showing plaintext credentials/file data in PDU capture

## Notes

- The "Unsafe Network Detected" banner is a **simulated** demo feature — browsers cannot actually detect real Wi-Fi security status; device pairing and encryption remain mandatory regardless.
- The "🧪 Demo: Simulate Tampering" button on the receive screen is an intentional test feature for live demonstration of the integrity-check failure case.