import { playRandomAudio, startRecording } from "../functions/audio.js";
import { joinCall } from "../functions/voice.js";

export async function run(client, message) {
  const connection = joinCall(message);

  if (!connection) return;

  message.reply("Gravando audio...");
  startRecording(connection, client);
  playRandomAudio(connection);
};

export const name = "entrar";
