// game.js
import { startSignaling, broadcast } from "./webrtc.js";
import { updateCharacter } from "./network.js"; // optional: save chosen char

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let myId = crypto.randomUUID();
let roomIdGlobal = null;
let playerNameGlobal = null;
let myChar = null;

const localState = { x: 100, y: 300, hp: 100, char: null, name: null };
const remoteStates = {}; // peerId -> state

let keys = {};
let lastSend = 0;

export async function startGame(roomId, playerName, char) {
  roomIdGlobal = roomId;
  playerNameGlobal = playerName;
  myChar = char;
  localState.char = char;
  localState.name = playerName;
  // optionally save selection
  await updateCharacter(roomId, myId, playerName, char);

  // Start signaling and set message handler
  await startSignaling(roomId, myId, handleIncomingData);

  // input listeners
  window.addEventListener("keydown", (e) => (keys[e.key] = true));
  window.addEventListener("keyup", (e) => (keys[e.key] = false));

  requestAnimationFrame(loop);
}

function handleIncomingData(obj, fromPeerId) {
  // expected message format: {type:"state", state: {...} }
  if (obj.type === "state") {
    remoteStates[fromPeerId] = obj.state;
  }
  if (obj.type === "chat") {
    console.log("[peer chat]", fromPeerId, obj.text);
  }
}

function update(dt) {
  const speed = 3;
  if (keys["a"]) localState.x -= speed;
  if (keys["d"]) localState.x += speed;
  if (keys["w"]) localState.y -= speed;
  if (keys["s"]) localState.y += speed;

  // clamp
  localState.x = Math.max(20, Math.min(canvas.width - 20, localState.x));
  localState.y = Math.max(20, Math.min(canvas.height - 20, localState.y));

  // send updates at ~30Hz (33ms)
  const now = performance.now();
  if (now - lastSend > 33) {
    lastSend = now;
    broadcast({ type: "state", state: localState });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw local
  ctx.fillStyle = "white";
  ctx.fillText(`${localState.name} (${localState.char})`, localState.x, localState.y - 30);
  ctx.fillStyle = "cyan";
  ctx.fillRect(localState.x - 16, localState.y - 16, 32, 32);

  // draw remotes
  let i = 0;
  for (const peerId in remoteStates) {
    const s = remoteStates[peerId];
    ctx.fillStyle = "white";
    ctx.fillText(`${s.name || peerId}`, s.x, s.y - 30);
    ctx.fillStyle = ["red","lime","yellow","purple"][i % 4];
    ctx.fillRect(s.x - 16, s.y - 16, 32, 32);
    i++;
  }
}

function loop(ts) {
  update(0);
  draw();
  requestAnimationFrame(loop);
}
