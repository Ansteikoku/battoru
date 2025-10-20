// network.js
import { supabase } from "./supabaseClient.js";

/** ROOMS **/
export async function createRoom(roomName) {
  const { data, error } = await supabase.from("rooms").insert([{ room_name: roomName }]);
  if (error) console.error("createRoom:", error);
  return data?.[0];
}

export async function listRooms() {
  const { data, error } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
  if (error) console.error("listRooms:", error);
  return data || [];
}

/** CHAT **/
export async function sendChatMessage(roomId, playerName, message) {
  await supabase.from("chat_messages").insert([{ room_id: roomId, player_name: playerName, message }]);
}

export function subscribeChat(roomId, onMessage) {
  const channel = supabase
    .channel("chat-" + roomId)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
      (payload) => onMessage(payload.new))
    .subscribe();

  // initial load
  supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).then(({ data }) => {
    if (data) data.forEach(m => onMessage(m));
  });

  return channel;
}

/** room_players: キャラ選択状態 **/
export async function updateCharacter(roomId, playerId, playerName, character) {
  // upsert by player_id + room_id
  const { data: existing } = await supabase.from("room_players").select("*")
    .eq("room_id", roomId).eq("player_id", playerId).maybeSingle();

  if (existing) {
    await supabase.from("room_players").update({ character }).eq("id", existing.id);
  } else {
    await supabase.from("room_players").insert([{ room_id: roomId, player_id: playerId, player_name: playerName, character }]);
  }
}

export function subscribePlayers(roomId, onUpdate) {
  supabase
    .channel("players-" + roomId)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, () => {
      // fetch full list
      supabase.from("room_players").select("*").eq("room_id", roomId).order("inserted_at", { ascending: true }).then(({ data }) => {
        onUpdate(data || []);
      });
    })
    .subscribe();

  // initial fetch
  supabase.from("room_players").select("*").eq("room_id", roomId).order("inserted_at", { ascending: true }).then(({ data }) => {
    onUpdate(data || []);
  });
}

/** SIGNALS: シグナリング（offer/answer/candidate/join） **/
export async function sendSignal(roomId, fromId, toId, type, payload) {
  await supabase.from("signals").insert([{ room_id: roomId, from_id: fromId, to_id: toId, type, payload }]);
}

export function subscribeSignals(roomId, onSignal) {
  // Subscribe to changes on signals table related to this room
  const channel = supabase
    .channel("signals-" + roomId)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals", filter: `room_id=eq.${roomId}` }, (payload) => {
      onSignal(payload.new);
    })
    .subscribe();

  return channel;
}

// small helper to cleanup old signals (optional)
// export async function clearSignals(roomId) { await supabase.from("signals").delete().eq('room_id', roomId); }
