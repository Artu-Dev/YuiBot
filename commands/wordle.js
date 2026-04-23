import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelFlags } from "discord.js";
import {
  getOrCreateUser,
  addChars,
  reduceChars,
  getSpendableChars,
  getServerConfig
} from "../database.js";
import { renderWordleImage } from "../functions/wordleCanva.js";
import {
  DICTIONARY,
  getOrCreateDailyWord,
  saveWordleResult,
  updateWordleStats,
  wordlePlayedToday,
} from "../functions/database/wordle.js";

export const name = "wordle";
export const aliases = ["termoo", "termo"];
export const requiresCharLimit = true;

const JOIN_TIME = 30_000;
const GAME_TIME = 600_000;
const PENALTY   = 500;
const MAX_ATT   = 6;

const BASE_ATTEMPT_REWARD = 100;
const PLAYER_BONUS        = 50;

const activeGames = new Map();



// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeWord(w) {
  return w.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function checkGuess(guess, answer) {
  const result = Array.from({ length: 5 }, (_, i) => ({ letter: guess[i], status: "absent" }));
  const ans    = [...answer];
  const used   = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) { result[i].status = "correct"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i].status === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === ans[j]) { result[i].status = "present"; used[j] = true; break; }
    }
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildGamePayload(attempts, usedLetters, statusText, embedOpts = {}) {
  const buffer     = renderWordleImage(attempts, usedLetters);
  const attachment = new AttachmentBuilder(buffer, { name: "wordle.png" });
  const embed = new EmbedBuilder()
    .setColor(embedOpts.color ?? "#2ECC71")
    .setImage("attachment://wordle.png")
    .setDescription(embedOpts.description ?? "")
    .setFooter({ text: statusText });
  if (embedOpts.title) embed.setTitle(embedOpts.title);
  return { embeds: [embed], files: [attachment] };
}

function buildFinalPayload(attempts, usedLetters, { won, answer, playerList, footerText }) {
  const buffer     = renderWordleImage(attempts, usedLetters);
  const attachment = new AttachmentBuilder(buffer, { name: "wordle.png" });
  const embed = new EmbedBuilder()
    .setColor(won ? "#F1C40F" : "#FF6B6B")
    .setTitle("Termoo da YUI!")
    .setDescription(`**Jogadores:**\n${playerList}`)
    .setImage("attachment://wordle.png")
    .setFooter({ text: footerText });
  return { embeds: [embed], files: [attachment] };
}

async function replaceMessage(oldMsg, payload) {
  const channel = oldMsg.channel;
  await oldMsg.delete().catch(() => {});
  return await channel.send(payload);
}

async function startGame(client, channel, initialMsg, answer, players, guildId) {
  const attempts    = [];
  const usedLetters = {};
  const playerList  = () => [...players.values()].map(n => `• ${n}`).join("\n");

  let currentMsg = await replaceMessage(initialMsg,
    buildGamePayload(attempts, usedLetters, `Tentativas: 0/${MAX_ATT}`, {
      title: "Termoo da YUI!",
      description: `**Jogadores:**\n${playerList()}`,
    })
  );

  const collector = channel.createMessageCollector({
    filter: msg =>
      players.has(msg.author.id) &&
      /^[a-zA-ZÀ-ú]{5}$/.test(msg.content.trim()),
    time: GAME_TIME,
  });

  const finish = async (won, triggerMsg = null) => {
    collector.stop("finished");
    activeGames.delete(guildId);
    const playerIds    = [...players.keys()];
    const attemptCount = attempts.length;

    saveWordleResult({ guildId, word: answer, won, attempts: attemptCount, playerIds });
    for (const pid of playerIds) updateWordleStats(pid, guildId, won);

    let rewardAmount = 0;
    let announceDesc = "";
    const winnerName = triggerMsg ? players.get(triggerMsg.author.id) : null;

    if (won) {
      rewardAmount = (MAX_ATT - attemptCount + 1) * BASE_ATTEMPT_REWARD + (players.size - 1) * PLAYER_BONUS;
      for (const pid of playerIds) await addChars(pid, guildId, rewardAmount);

      announceDesc = [
        `**${winnerName}** encontrou a palavra em **${attemptCount}/${MAX_ATT}** tentativas!`,
        ``,
        `A palavra era **${answer}**.`,
        ``,
        `Cada um de voces malditos ganharam **+${rewardAmount} chars**`
        ,
      ].join("\n");
    } else {
      for (const pid of playerIds) await reduceChars(pid, guildId, PENALTY, true);

      announceDesc = [
        `💀 Voces falharam mizeravelmente mortais...`,
        ``,
        `A palavra era **${answer}**.`,
        ``,
        `Cada jogador perdeu **-${PENALTY} chars**.`,
      ].join("\n");
    }

    const footerText = won
      ? `✅ ${winnerName} acertou! • ${attemptCount}/${MAX_ATT} tentativas`
      : `❌ Palavra: ${answer} • ${attemptCount}/${MAX_ATT} tentativas`;

    currentMsg = await replaceMessage(currentMsg,
      buildFinalPayload(attempts, usedLetters, {
        won,
        answer,
        playerList: playerList(),
        footerText,
      })
    );

    const announceEmbed = new EmbedBuilder()
      .setColor(won ? "#F1C40F" : "#FF6B6B")
      .setTitle(won ? "🏆 Vitória!" : "💀 Derrota!")
      .setDescription(announceDesc)
      .setFooter({ text: `${playerIds.length} jogador${playerIds.length > 1 ? "es" : ""}` });

    await channel.send({ embeds: [announceEmbed] });
  };

  collector.on("collect", async (msg) => {
    const rawGuess = msg.content.trim();
    const guess = normalizeWord(rawGuess);
    const willDelete = msg.delete().catch(() => {});

    if (!/^[A-Z]{5}$/.test(guess) || !DICTIONARY.has(guess)) {
        await willDelete;
        const invalidMsg = await channel.send(
        `❌ **${players.get(msg.author.id)}**, "${rawGuess}" não é uma palavra válida de 5 letras.`
        );
        setTimeout(() => invalidMsg.delete().catch(() => {}), 5000);
        return;
    }

    const result = checkGuess(guess, answer);
    attempts.push(result);

    for (const { letter, status } of result) {
      const prev = usedLetters[letter];
      if (prev === "correct") continue;
      if (prev === "present" && status === "absent") continue;
      usedLetters[letter] = status;
    }

    const won = result.every(r => r.status === "correct");
    if (won) {
      await willDelete;
      return finish(true, msg);
    }

    if (attempts.length >= MAX_ATT) {
      await willDelete;
      return finish(false);
    }

    const guesserName = players.get(msg.author.id);
    const newPayload = buildGamePayload(
      attempts,
      usedLetters,
      `Tentativas: ${attempts.length}/${MAX_ATT}  •  Última: ${guesserName} → ${guess}`,
      {
        title: "Termoo da YUI!",
        description: `**Jogadores:**\n${playerList()}`,
      }
    );

    currentMsg = await replaceMessage(currentMsg, newPayload);
  });

  collector.on("end", async (_, reason) => {
    if (reason === "finished") return;
    activeGames.delete(guildId);
    await replaceMessage(currentMsg, {
      embeds: [
        new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle("⏱️ Tempo esgotado!")
          .setDescription(`A palavra era **${answer}**. Jogo encerrado por inatividade.`),
      ],
      files: [],
    });
  });
}

export async function execute(client, data) {
  const { userId, guildId, displayName } = data;

  if (!getServerConfig(guildId, "charLimitEnabled")) {
    return data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }
  if (activeGames.has(guildId)) {
    return data.reply("❌ Já tem uma partida de Termoo rolando neste servidor!");
  }
  if (wordlePlayedToday(guildId)) {
    return data.reply("📅 O Termoo de hoje neste servidor já foi jogado! Volte amanhã.");
  }

  getOrCreateUser(userId, displayName, guildId);

  if (DICTIONARY.size === 0) console.log("ue dicionario vazio man");
  const wordArray = Array.from(DICTIONARY);
  const dailyWord = getOrCreateDailyWord(guildId, wordArray);

  // ─── Lobby ─────────────────────────────────────────────────────────────────
  const players = new Map([[userId, displayName]]);
  activeGames.set(guildId, true);

  const buildLobbyEmbed = () =>
    new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("Termoo da YUI — Lobby")
      .setDescription([
        `**${displayName}** quer jogar Termoo!`,
        "",
        "Precisa de pelo menos **2 jogadores** para começar.",
        "O jogo começa em **30 segundos** (ou quando o dono iniciar).",
        "",
        "Se ganharem podem ganhar ate 600 chars (-100 a cada tentativa).",
        "+50 chars a cada player!.",
        "Se perderem, cada jogador um dos malditos perdem 500 chars.",
        "",
        `**Jogadores (${players.size}):**`,
        ...[...players.values()].map(n => `• ${n}`),
      ].join("\n"))
      .setFooter({ text: "Adivinhe a palavra de 5 letras em até 6 tentativas!" });

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("termoo_join")
      .setLabel("Entrar no jogo!")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("termoo_start")
      .setLabel("COMEÇAR LOGO!")
      .setStyle(ButtonStyle.Success)
  );

  const lobbyMsg = await data.reply({
    embeds: [buildLobbyEmbed()],
    components: [joinRow],
    fetchReply: true,
  });

  const joinCollector = lobbyMsg.createMessageComponentCollector({ time: JOIN_TIME });

  joinCollector.on("collect", async (btnInt) => {
    if (btnInt.customId === "termoo_join") {
      if (players.has(btnInt.user.id)) {
        return btnInt.reply({ content: "Você já está na partida!", flags: ChannelFlags.Ephemeral} );
      }
      getOrCreateUser(btnInt.user.id, btnInt.user.displayName, guildId);
      players.set(btnInt.user.id, btnInt.user.displayName);
      return btnInt.update({ embeds: [buildLobbyEmbed()] });
    }
    if (btnInt.customId === "termoo_start") {
      if (btnInt.user.id !== userId) {
        return btnInt.reply({ content: "Só quem iniciou pode forçar o início!", flags: ChannelFlags.Ephemeral });
      }
      if (players.size < 2) {
        return btnInt.reply({ content: "Precisa de pelo menos 2 jogadores!", flags: ChannelFlags.Ephemeral });
      }
      joinCollector.stop("force_start");
      await btnInt.deferUpdate().catch(() => {});
    }
  });

  joinCollector.on("end", async () => {
    if (players.size < 2) {
      activeGames.delete(guildId);
      return lobbyMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor("#FF6B6B")
            .setTitle("❌ Jogo cancelado")
            .setDescription("Não apareceram jogadores suficientes. Precisa de pelo menos 2 pessoas!"),
        ],
        components: [],
      });
    }
    startGame(client, lobbyMsg.channel, lobbyMsg, dailyWord, players, guildId);
  });
}