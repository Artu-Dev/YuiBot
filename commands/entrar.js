import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { playRandomAudio, startRecording } from "../functions/audio.js";
import { joinCall } from "../functions/voice/tts.js";
import { getVoiceConnection } from "@discordjs/voice";
import { getRandomTime } from "../functions/utils.js";

export const name = "entrar";
export const aliases = ["join", "vc", "conectar"];

export const data = new SlashCommandBuilder()
  .setName("entrar")
  .setDescription("Faz o bot entrar no canal de voz atual.");

function parseArgs(data) {
  // No args for entrar
  return {};
}

export async function execute(client, data) {
  const connection = joinCall(data);
  if (!connection) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor("#4ECDC4")
    .setTitle("🎤 Entrando na call")
    .setDescription("ESCUTANDO TUDINHO E ANOTANDO...");
  data.reply({ embeds: [embed] });
  
  startRecording(connection, client);
  
  setTimeout(() => {
    playRandomAudio(connection);
  }, getRandomTime(120, 300) * 1000);
}