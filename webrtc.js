// webrtc.js
import { subscribeSignals, sendSignal } from "./network.js";

const peers = {}; // peerId -> { pc, dc }
let localId = null;
let roomIdGlobal = null;
let onDataCallback = null;

const pcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export async function startSignaling(roomId, myId, onData) {
  localId = myId;
  roomIdGlobal = roomId;
  onDataCallback = onData;

  // subscribe to signals for room
  subscribeSignals(roomId, async (sig) => {
    // ignore own signals
    if (!sig) return;
    if (sig.from_id === localId) return;

    const type = sig.type;
    const from = sig.from_id;
    // if to_id exists and isn't me, ignore
    if (sig.to_id && sig.to_id !== localId) return;

    if (type === "join") {
      // someone joined -> create offer to them (we are existing peer)
      await createOfferToPeer(from);
    } else if (type === "offer") {
      // received offer from someone (they initiated to me)
      await handleOffer(from, sig.payload);
    } else if (type === "answer") {
      await handleAnswer(from, sig.payload);
    } else if (type === "candidate") {
      await handleCandidate(from, sig.payload);
    }
  });

  // announce self
  await sendSignal(roomId, localId, null, "join", { ts: Date.now() });
}

function createPeerConnection(peerId, isInitiator = false) {
  if (peers[peerId]) return peers[peerId];

  const pc = new RTCPeerConnection(pcConfig);
  let dc = null;

  // setup handlers
  pc.onicecandidate = (evt) => {
    if (evt.candidate) {
      sendSignal(roomIdGlobal, localId, peerId, "candidate", evt.candidate.toJSON());
    }
  };

  pc.onconnectionstatechange = () => {
    // console.log("PC state", peerId, pc.connectionState);
    if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
      // cleanup
      if (peers[peerId]) {
        try { peers[peerId].pc.close(); } catch {}
        delete peers[peerId];
      }
    }
  };

  pc.ondatachannel = (event) => {
    dc = event.channel;
    setupDataChannel(peerId, dc);
  };

  // create data channel if initiator
  if (isInitiator) {
    dc = pc.createDataChannel("game");
    setupDataChannel(peerId, dc);
  }

  peers[peerId] = { pc, dc };
  return peers[peerId];
}

function setupDataChannel(peerId, dc) {
  dc.onopen = () => {
    console.log("DataChannel open", peerId);
  };
  dc.onmessage = (e) => {
    if (!e.data) return;
    try {
      const obj = JSON.parse(e.data);
      if (onDataCallback) onDataCallback(obj, peerId);
    } catch (err) {
      console.error("parse message", err);
    }
  };
  dc.onclose = () => { console.log("DataChannel close", peerId); };
  peers[peerId].dc = dc;
}

async function createOfferToPeer(peerId) {
  const { pc } = createPeerConnection(peerId, true);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // send offer to peerId
  await sendSignal(roomIdGlobal, localId, peerId, "offer", offer);
}

async function handleOffer(fromId, offer) {
  const { pc } = createPeerConnection(fromId, false);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sendSignal(roomIdGlobal, localId, fromId, "answer", answer);
}

async function handleAnswer(fromId, answer) {
  const entry = peers[fromId];
  if (!entry || !entry.pc) {
    console.warn("No pc for answer from", fromId);
    return;
  }
  await entry.pc.setRemoteDescription(answer);
}

async function handleCandidate(fromId, candidate) {
  const entry = peers[fromId];
  if (!entry || !entry.pc) {
    console.warn("No pc for candidate from", fromId);
    return;
  }
  try {
    await entry.pc.addIceCandidate(candidate);
  } catch (err) {
    console.warn("addIceCandidate err", err);
  }
}

// send object to all open datachannels
export function broadcast(obj) {
  const s = JSON.stringify(obj);
  Object.values(peers).forEach(p => {
    if (p.dc && p.dc.readyState === "open") {
      p.dc.send(s);
    }
  });
}

// send to specific peer
export function sendToPeer(peerId, obj) {
  const p = peers[peerId];
  if (p && p.dc && p.dc.readyState === "open") {
    p.dc.send(JSON.stringify(obj));
  }
}

// get connected peer ids
export function getPeerIds() {
  return Object.keys(peers);
}
