import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelFlags } from "discord.js";
import {
  getOrCreateUser,
  addChars,
  reduceChars,
  getSpendableChars,
  getServerConfig,
} from "../database.js";
import { renderDuetoImage } from "../functions/wordleCanva.js";
import {
  DICTIONARY,
  getOrCreateDailyDueto,
  duoPlayedToday,
  saveDuoResult,
  wordlePlayedToday,
} from "../functions/database/wordle.js";

export const name = "dueto";
export const aliases = ["wordleduo", "termoduo", "duo", "termo2", "wordle2"];
export const requiresCharLimit = true;

const JOIN_TIME  = 30_000;
const GAME_TIME  = 600_000;
const MAX_ATT    = 7;
const DUO_REWARD = 500;


const activeDuoGames = new Map();

function normalizeWord(w) {
  return w.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function checkGuess(normalizedGuess, accentedAnswer) {
  const normAnswer = accentedAnswer.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const result = Array.from({ length: 5 }, (_, i) => ({
    letter: normalizedGuess[i],
    status: "absent",
  }));

  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (normalizedGuess[i] === normAnswer[i]) {
      result[i].status = "correct";
      result[i].letter = accentedAnswer[i];
      used[i] = true;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i].status === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && normalizedGuess[i] === normAnswer[j]) {
        result[i].status = "present";
        used[j] = true;
        break;
      }
    }
  }

  return result;
}




const STATUS_PRIORITY = { correct: 3, present: 2, absent: 1 };
function mergeStatus(prev, next) {
  if (!prev) return next;
  return (STATUS_PRIORITY[next] ?? 0) > (STATUS_PRIORITY[prev] ?? 0) ? next : prev;
}

async function replaceMessage(oldMsg, payload) {
  await oldMsg.delete().catch(() => {});
  return oldMsg.channel.send(payload);
}

// ─── Jogo ─────────────────────────────────────────────────────────────────────
async function startDuoGame(client, channel, initialMsg, answers, players, guildId) {
  const [answerLeft, answerRight] = answers;
  const attemptsLeft  = [];
  const attemptsRight = [];
  const usedLetters   = {};
  const usedLettersLeft  = {};
  const usedLettersRight = {};
  let totalGuesses    = 0;
  let solvedLeft      = false;
  let solvedRight     = false;

  const playerList = () => [...players.values()].map(n => `• ${n}`).join("\n");

  const buildPayload = (footerText, desc, color = "#9B59B6") => {
    const buffer     = renderDuetoImage(attemptsLeft, attemptsRight, usedLettersLeft, usedLettersRight, solvedLeft, solvedRight);
    const attachment = new AttachmentBuilder(buffer, { name: "dueto.png" });
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle("Termo 2 da YUI!")
      .setImage("attachment://dueto.png")
      .setDescription(`${desc}`)
      .setFooter({ text: footerText });
    return { embeds: [embed], files: [attachment] };
  };

  const statusLine = () => {
    const l = solvedLeft  ? "✅ Resolvida" : `⬅️ ${attemptsLeft.length}/${MAX_ATT}`;
    const r = solvedRight ? "✅ Resolvida" : `➡️ ${attemptsRight.length}/${MAX_ATT}`;
    return `${l}  •  ${r}`;
  };

  let currentMsg = await replaceMessage(initialMsg,
    buildPayload(
      `Tentativas: 0/${MAX_ATT}`,
      `**Jogadores:**\n${playerList()}\n\n${statusLine()}\n\nAdivinhe as **2 palavras** ao mesmo tempo!`
    )
  );

  const collector = channel.createMessageCollector({
    filter: msg => players.has(msg.author.id) && /^[a-zA-ZÀ-ú]{5}$/.test(msg.content.trim()),
    time: GAME_TIME,
  });

  const finish = async (won, triggerMsg = null) => {
    collector.stop("finished");
    activeDuoGames.delete(guildId);
    const playerIds  = [...players.keys()];
    const winnerName = triggerMsg ? players.get(triggerMsg.author.id) : null;

    saveDuoResult({ guildId, word1: answerLeft, word2: answerRight, won, attempts: totalGuesses, playerIds });

    let announceDesc;

    if (won) {
      for (const pid of playerIds) await addChars(pid, guildId, DUO_REWARD);
      announceDesc = [
        `🎉 **${winnerName}** completou o Dueto em **${totalGuesses}/${MAX_ATT}** tentativas!`,
        ``,
        `As palavras eram **${answerLeft}** e **${answerRight}**.`,
        ``,
        `Cada um ganhou **+${DUO_REWARD} chars**!`,
      ].join("\n");
    } else {
      for (const pid of playerIds) {
        const current = await getSpendableChars(pid, guildId);
        await reduceChars(pid, guildId, current, true);
      }
      announceDesc = [
        `💀 **Destruídos.** As palavras eram **${answerLeft}** e **${answerRight}**.`,
        ``,
        `Cada um perdeu **TODOS os seus chars**.`,
        ``,
        `Deveriam ter estudado mais.`,
      ].join("\n");
    }

    const footerText = won
      ? `✅ ${winnerName} completou! • ${totalGuesses}/${MAX_ATT} tentativas`
      : `❌ ${answerLeft} | ${answerRight} • ${totalGuesses}/${MAX_ATT} tentativas`;

    currentMsg = await replaceMessage(currentMsg,
      buildPayload(footerText, `**Jogadores:**\n${playerList()}`, won ? "#F1C40F" : "#FF6B6B")
    );

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(won ? "#F1C40F" : "#FF6B6B")
          .setTitle(won ? "🏆 Dueto Completo!" : "💀 Dueto Perdido...")
          .setDescription(announceDesc)
          .setFooter({ text: `${playerIds.length} jogador${playerIds.length > 1 ? "es" : ""}` }),
      ],
    });
  };

  collector.on("collect", async (msg) => {
    const rawGuess = msg.content.trim();
    const guess = normalizeWord(rawGuess);
    const willDelete = msg.delete().catch(() => {});

    if (!/^[A-Z]{5}$/.test(guess) || !DICTIONARY.has(guess)) {
      await willDelete;
      const invalidMsg = await channel.send(
        `❌ **${players.get(msg.author.id)}**, "${rawGuess}" não é uma palavra válida.`
      );
      setTimeout(() => invalidMsg.delete().catch(() => {}), 5000);
      return;
    }

    totalGuesses++;

    // Processa cada tabuleiro independentemente
    if (!solvedLeft) {
      const result = checkGuess(guess, answerLeft);
      attemptsLeft.push(result);
      for (const { letter, status } of result) {
        const prev = usedLettersLeft[letter];
        if (prev !== "correct" && !(prev === "present" && status === "absent"))
          usedLettersLeft[letter] = status;
      }
      if (result.every(r => r.status === "correct")) solvedLeft = true;
    }

    if (!solvedRight) {
      const result = checkGuess(guess, answerRight);
      attemptsRight.push(result);
      for (const { letter, status } of result) {
        const prev = usedLettersRight[letter];
        if (prev !== "correct" && !(prev === "present" && status === "absent"))
          usedLettersRight[letter] = status;
      }
      if (result.every(r => r.status === "correct")) solvedRight = true;
    }

    if (solvedLeft && solvedRight) {
      await willDelete;
      return finish(true, msg);
    }

    if (totalGuesses >= MAX_ATT) {
      await willDelete;
      return finish(false);
    }

    const guesserName = players.get(msg.author.id);
    currentMsg = await replaceMessage(currentMsg,
      buildPayload(
        `Tentativas: ${totalGuesses}/${MAX_ATT}  •  Última: ${guesserName} → ${guess}`,
        `**Jogadores:**\n${playerList()}\n\n${statusLine()}\n\nMande uma palavra de 5 letras.`
      )
    );
  });

  collector.on("end", async (_, reason) => {
    if (reason === "finished") return;
    await finish(false);
    activeDuoGames.delete(guildId);
    await replaceMessage(currentMsg, {
      embeds: [
        new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle("⏱️ Tempo esgotado!")
          .setDescription(`As palavras eram **${answerLeft}** e **${answerRight}**. Jogo encerrado por inatividade.`),
      ],
      files: [],
    });
  });
}

// ─── Comando principal ─────────────────────────────────────────────────────────
export async function execute(client, data) {
  const { userId, guildId, displayName } = data;

  if (!getServerConfig(guildId, "charLimitEnabled"))
    return data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  if (activeDuoGames.has(guildId))
    return data.reply("❌ Já tem uma partida de Dueto rolando neste servidor!");
  if (duoPlayedToday(guildId))
    return data.reply("📅 O Dueto de hoje já foi jogado! Volte amanhã.");
  if (!wordlePlayedToday(guildId))
    return data.reply("❌ Joguem o **Termoo** normal primeiro antes de tentar o Dueto!");

  getOrCreateUser(userId, displayName, guildId);

  const dailyWords = getOrCreateDailyDueto(guildId);


  const players = new Map([[userId, displayName]]);
  activeDuoGames.set(guildId, true);

  const buildLobbyEmbed = () =>
    new EmbedBuilder()
      .setColor("#9B59B6")
      .setTitle("🟪 Termoo Dueto da YUI — Lobby")
      .setDescription([
        `**${displayName}** quer jogar Termoo Dueto!`,
        "",
        "O mesmo termo de sempre mas com 2 palavras ao mesmo tempo!!",
        "",
        "⚠️ Se nao conseguirem voces perdem **TODOS** os chars ⚠️",
        `🏆 Mas se ganharem levam +${DUO_REWARD} chars**.`,
        "",
        `**Jogadores corajosos (${players.size}):**`,
        ...[...players.values()].map(n => `• ${n}`),
      ].join("\n"))
      .setFooter({ text: "2 palavras • o dobro de perigo!!!" });

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dueto_join").setLabel("Participar").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("dueto_start").setLabel("COMEÇAR LOGO!").setStyle(ButtonStyle.Success)
  );

  const lobbyMsg = await data.reply({ embeds: [buildLobbyEmbed()], components: [joinRow], fetchReply: true });
  const joinCollector = lobbyMsg.createMessageComponentCollector({ time: JOIN_TIME });

  joinCollector.on("collect", async (btnInt) => {
    if (btnInt.customId === "dueto_join") {
      if (players.has(btnInt.user.id))
        return btnInt.reply({ content: "Você já está na partida!", flags: ChannelFlags.Ephemeral });
      getOrCreateUser(btnInt.user.id, btnInt.user.displayName, guildId);
      players.set(btnInt.user.id, btnInt.user.displayName);
      return btnInt.update({ embeds: [buildLobbyEmbed()] });
    }
    if (btnInt.customId === "dueto_start") {
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
      activeDuoGames.delete(guildId);
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
    startDuoGame(client, lobbyMsg.channel, lobbyMsg, dailyWords, players, guildId);
  });
}