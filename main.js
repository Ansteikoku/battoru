// main.js
import { createRoom, listRooms, sendChatMessage, subscribeChat, subscribePlayers, updateCharacter } from "./network.js";
import { startGame } from "./game.js";

let currentRoom = null;
let playerName = "";
let selectedChar = null;
let playerId = crypto.randomUUID();

// DOM refs
const roomListEl = document.getElementById("roomList");
const createBtn = document.getElementById("createBtn");
const roomNameEl = document.getElementById("roomName");
const chatEl = document.getElementById("chat");
const lobbyEl = document.getElementById("lobby");
const messagesEl = document.getElementById("messages");
const roomTitleEl = document.getElementById("roomTitle");
const nameInput = document.getElementById("playerName");
const startGameBtn = document.getElementById("startGameBtn");
const selectCharBtn = document.getElementById("selectCharBtn");

// initial player name ask
playerName = prompt("プレイヤー名を入力してください（短め）") || ("Player" + Math.floor(Math.random()*999));

// create room
createBtn.onclick = async () => {
  const rn = roomNameEl.value.trim();
  if (!rn) return;
  await createRoom(rn);
  await refreshRooms();
};

async function refreshRooms() {
  const rooms = await listRooms();
  roomListEl.innerHTML = "";
  rooms.forEach(r => {
    const d = document.createElement("div");
    d.className = "room-item";
    d.textContent = r.room_name;
    d.onclick = () => enterRoom(r);
    roomListEl.appendChild(d);
  });
}

async function enterRoom(r) {
  currentRoom = r;
  lobbyEl.style.display = "none";
  chatEl.style.display = "block";
  roomTitleEl.textContent = `💬 ${r.room_name}`;

  // subscribe chat
  subscribeChat(r.id, addMessage);

  // subscribe players list & show join message
  subscribePlayers(r.id, (list) => {
    // display list in messages box header
    const header = document.createElement("div");
    header.style.color = "#0ff";
    header.textContent = "[参加者] " + list.map(p => `${p.player_name}:${p.character||"未選択"}`).join(", ");
    messagesEl.prepend(header);
  });

  // post system join message
  await sendChatMessage(r.id, "system", `${playerName} が入室しました`);
}

function addMessage(m) {
  const d = document.createElement("div");
  d.textContent = `${m.player_name}: ${m.message}`;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// chat send
document.getElementById("sendBtn").onclick = async () => {
  const text = document.getElementById("chatInput").value.trim();
  if (!text || !currentRoom) return;
  await sendChatMessage(currentRoom.id, playerName, text);
  document.getElementById("chatInput").value = "";
};

// open char select overlay
selectCharBtn.onclick = () => {
  document.getElementById("charSelect").style.display = "block";
  document.getElementById("chat").style.display = "none";
};

// char selection buttons
document.querySelectorAll(".char-card").forEach((card) => {
  card.onclick = () => {
    document.querySelectorAll(".char-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedChar = card.dataset.char;
  };
});

document.getElementById("charConfirmBtn").onclick = async () => {
  if (!selectedChar || !currentRoom) { alert("キャラ選んでから決定してください"); return; }
  // save selection to DB so others see it
  await updateCharacter(currentRoom.id, playerId, playerName, selectedChar);
  // return to chat
  document.getElementById("charSelect").style.display = "none";
  document.getElementById("chat").style.display = "block";
  addMessage({ player_name: "system", message: `${playerName} が ${selectedChar} を選択しました` });
};

document.getElementById("cancelCharBtn").onclick = () => {
  document.getElementById("charSelect").style.display = "none";
  document.getElementById("chat").style.display = "block";
};

// start game button
startGameBtn.onclick = async () => {
  if (!selectedChar) { alert("部屋でキャラ選択してください"); return; }
  // hide UI and start
  document.getElementById("chat").style.display = "none";
  document.getElementById("gameCanvas").style.display = "block";
  await startGame(currentRoom.id, playerName, selectedChar);
};

// initial load
refreshRooms();
setInterval(refreshRooms, 5000);
