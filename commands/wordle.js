import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import {
  getOrCreateUser,
  addChars,
  reduceChars,
  getSpendableChars,
  getServerConfig,
  getOrCreateDailyWord,
  saveWordleResult,
  wordlePlayedToday,
  updateWordleStats,
} from "../database.js";
import { renderWordleImage } from "../functions/wordleCanva.js";

export const name = "wordle";
export const aliases = ["termoo", "termo"];
export const requiresCharLimit = true;

const JOIN_TIME = 30_000;
const GAME_TIME = 600_000;
const REWARD    = 500;
const PENALTY   = 500;
const MAX_ATT   = 6;

const activeGames = new Map();

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

// ─── Helpers de mensagem ──────────────────────────────────────────────────────

function buildGamePayload(attempts, usedLetters, statusText, embedOpts = {}) {
  const buffer     = renderWordleImage(attempts, usedLetters);
  const attachment = new AttachmentBuilder(buffer, { name: "wordle.png" });

  const embed = new EmbedBuilder()
    .setColor(embedOpts.color ?? "#2ECC71")
    .setImage("attachment://wordle.png")
    .setDescription(`
        ${embedOpts.description ?? null}
        Vitoria = +${REWARD} chars | Derrota = -${PENALTY} chars
    `)
    .setFooter({ text: statusText });

  if (embedOpts.title) embed.setTitle(embedOpts.title);

  return { embeds: [embed], files: [attachment] };
}

// ─── Fase de jogo ─────────────────────────────────────────────────────────────
async function startGame(client, channel, gameMsg, answer, players, guildId) {
  const attempts    = [];
  const usedLetters = {};
  const playerList  = () => [...players.values()].map(n => `• ${n}`).join("\n");

  await gameMsg.edit({
    ...buildGamePayload(attempts, usedLetters, `Tentativas: 0/${MAX_ATT}`, {
      title: "Termoo da YUI!",
      description: `**Jogadores:**\n${playerList()}\n\nMande uma palavra de 5 letras no chat!`,
    }),
    components: [],
  });

  const collector = channel.createMessageCollector({
    filter: msg =>
      players.has(msg.author.id) &&
      /^[a-zA-ZÀ-ú]{5}$/.test(msg.content.trim()),
    time: GAME_TIME,
  });

  const finish = async (won, triggerMsg = null) => {
    collector.stop("finished");
    activeGames.delete(guildId);

    const playerIds = [...players.keys()];
    saveWordleResult({ guildId, word: answer, won, attempts: attempts.length, playerIds });
    for (const pid of playerIds) updateWordleStats(pid, guildId, won);

    if (won) {
      for (const pid of playerIds) await addChars(pid, guildId, REWARD);
      const winnerName = triggerMsg ? players.get(triggerMsg.author.id) : "Alguém";
      await gameMsg.edit(buildGamePayload(
        attempts, usedLetters,
        `✅ ${winnerName} acertou em ${attempts.length}/${MAX_ATT}! A palavra era: ${answer}`,
        {
          color: "#F1C40F",
          title: "🟩 Termoo — ACERTARAM!",
          description: `🎉 Todos ganharam **+${REWARD} chars**!\n\n**Jogadores:**\n${playerList()}`,
        }
      ));
    } else {
      for (const pid of playerIds) {
        const saldo = await getSpendableChars(pid, guildId);
        if (saldo >= PENALTY) await reduceChars(pid, guildId, PENALTY, true);
      }
      await gameMsg.edit(buildGamePayload(
        attempts, usedLetters,
        `❌ Perderam! A palavra era: ${answer}`,
        {
          color: "#FF6B6B",
          title: "🟩 Termoo — PERDERAM!",
          description: `💀 Todos perderam **-${PENALTY} chars**!\n\n**Jogadores:**\n${playerList()}`,
        }
      ));
    }
  };

  collector.on("collect", async (msg) => {
    const guess = normalizeWord(msg.content.trim());

    // Apaga a mensagem do jogador (a não ser que acerte — deixa pra ser apagada depois)
    const willDelete = msg.delete().catch(() => {});

    if (!/^[A-Z]{5}$/.test(guess)) return;

    const result = checkGuess(guess, answer);
    attempts.push(result);

    // Atualiza teclado
    for (const { letter, status } of result) {
      const prev = usedLetters[letter];
      if (prev === "correct") continue;
      if (prev === "present" && status === "absent") continue;
      usedLetters[letter] = status;
    }

    const won = result.every(r => r.status === "correct");

    if (won) {
      await willDelete; // garante que apagou antes de editar
      return finish(true, msg);
    }
    if (attempts.length >= MAX_ATT) {
      await willDelete;
      return finish(false);
    }

    const guesserName = players.get(msg.author.id);
    await gameMsg.edit(buildGamePayload(
      attempts, usedLetters,
      `Tentativas: ${attempts.length}/${MAX_ATT}  •  Última: ${guesserName} → ${guess}`,
      {
        title: "Termoo da YUI!",
        description: `**Jogadores:**\n${playerList()}\n\nMande uma palavra de 5 letras no chat!`,
      }
    ));
  });

  collector.on("end", async (_, reason) => {
    if (reason === "finished") return;
    activeGames.delete(guildId);
    await gameMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor("#95A5A6")
          .setTitle("⏱️ Tempo esgotado!")
          .setDescription(`A palavra era \`${answer}\`. Jogo encerrado por inatividade.`),
      ],
      files: [],
      components: [],
    });
  });
}

// ─── Comando principal ────────────────────────────────────────────────────────
export async function execute(client, data) {
  const { userId, guildId, displayName } = data;

  if (!getServerConfig(guildId, "charLimitEnabled")) {
    return data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }
  if (activeGames.has(guildId)) {
    return data.reply("❌ Já tem uma partida de Termoo rolando neste servidor!");
  }
//   if (wordlePlayedToday(guildId)) {
//     return data.reply("📅 O Termoo de hoje neste servidor já foi jogado! Volte amanhã.");
//   }

  getOrCreateUser(userId, displayName, guildId);
  const dailyWord = getOrCreateDailyWord(guildId, WORDS);

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
        `O jogo começa em **30 segundos** (ou quando o dono iniciar).`,
        "",
        `**Jogadores (${players.size}):**`,
        ...[...players.values()].map(n => `• ${n}`),
      ].join("\n"))
      .setFooter({ text: "Adivinhe a palavra de 5 letras em até 6 tentativas!" });

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("termoo_join")
      .setLabel("Entrar no jogo!")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎮"),
    new ButtonBuilder()
      .setCustomId("termoo_start")
      .setLabel("Iniciar já!")
      .setStyle(ButtonStyle.Success)
      .setEmoji("▶️"),
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
        return btnInt.reply({ content: "Você já está na partida!", ephemeral: true });
      }
      getOrCreateUser(btnInt.user.id, btnInt.user.displayName, guildId);
      players.set(btnInt.user.id, btnInt.user.displayName);
      return btnInt.update({ embeds: [buildLobbyEmbed()] });
    }

    if (btnInt.customId === "termoo_start") {
      if (btnInt.user.id !== userId) {
        return btnInt.reply({ content: "Só quem iniciou pode forçar o início!", ephemeral: true });
      }
      if (players.size < 2) {
        return btnInt.reply({ content: "Precisa de pelo menos 2 jogadores!", ephemeral: true });
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

// ─── Lista de palavras ────────────────────────────────────────────────────────
const WORDS = [
  "ABRIR","ACASO","ACENO","ACIMA","AFAGO","AFETO","AGORA","AGUDO","AINDA",
  "ALADO","ALDAO","ALEGA","ALGUM","ALIOU","ALMAS","ALOCA","ALUGO","ALUNO",
  "AMADO","AMAGO","AMARA","AMARO","AMAVA","AMIGO","AMORA","AMPLA","ANCAS",
  "ANDAR","ANELO","ANGUS","ANIMA","ANIMO","ANJOS","ANTES","APAGA","APELO",
  "APOIA","APURO","ARARA","ARCAR","ARCAS","ARCOS","ARDOR","ARENA","ARGON",
  "ARIAS","ARMAS","AROMA","ARRAS","ARTES","ASADO","ASILO","ASPAS","ASSAR",
  "ASTRO","ATACA","ATADO","ATEAR","ATONA","ATRAS","ATRIZ","ATROZ","AVARO",
  "AVEIA","AVIAR","AVIDO","AVISO","AVOAR","BABAO","BAFIO","BAGRE","BAIXA",
  "BAIXO","BALAR","BANDO","BANIR","BAQUE","BARRA","BARCO","BARDO","BARRO",
  "BEATO","BEIJO","BELAS","BELGA","BELOS","BERCO","BICHO","BINGO","BLOCO",
  "BOATO","BOCAL","BOLAO","BOLHA","BOLSO","BOMBA","BONDE","BONUS","BORDO",
  "BOXAR","BRABO","BRACO","BRADO","BRAVO","BREVE","BRIGA","BROCA","BRUXA",
  "BUFAR","BURRO","BUSCA","CABER","CACHO","CALCA","CALMA","CALDO","CALOR",
  "CALVO","CAMPO","CANAL","CANTO","CARGA","CARGO","CARMA","CARNE","CARRO",
  "CARTA","CASAL","CASCA","CASCO","CAUSA","CEDER","CENHO","CENTO","CERCA",
  "CETRO","CHAGA","CHAMA","CHAPA","CHATO","CHAVE","CHEIO","CINCO","CIRCO",
  "CISCO","CLARO","CLUBE","COBRA","COBRE","COLAR","COLMO","CONDE","CONTO",
  "COPOS","CORDA","CORPO","CORTE","CORVO","COURO","CRACK","CRAVO","CRIAR",
  "CRIME","CRISE","CRUZA","CUBOS","CULPA","CURAR","CUSTO","DANCA","DARDO",
  "DEDAL","DENSA","DEUSA","DIABO","DISCO","DOLAR","DOSAR","DOTAR","DUPLA",
  "DURAR","EIXOS","ELITE","ENCOL","ENFIM","ESCOA","ETAPA","EVOCA","EXATO",
  "EXTRA","FALCO","FALHA","FALSA","FARSA","FATAL","FATIA","FAVOR","FERRO",
  "FINCA","FIRMA","FIXAR","FLORA","FLUIR","FOLHA","FORCA","FORTE","FOSSO",
  "FRACO","FRADE","FRASE","FRETE","FRUTO","FUGIR","FUMAR","FUNDO","FUROR",
  "FURTO","GAIOA","GAITA","GALAO","GAROA","GARRA","GEADA","GEMER","GENIO",
  "GERAL","GESSO","GIRAR","GLOBO","GOELA","GOLFE","GOLPE","GORDO","GOSTO",
  "GRACA","GRANA","GRATO","GRAUS","GRAVE","GREVE","GRITO","GRUPO","GUARA",
  "GUIAR","HAVER","HEROI","HONRA","HOTEL","HUMOR","ICONE","IDEAL","ILHAR",
  "INDIO","INSTA","IRADO","ISOLA","JANJO","JAULA","JOGAR","JOIAS","JURAR",
  "JUSTO","LABIO","LACRE","LANCE","LARGO","LASER","LAZER","LENTA","LENTO",
  "LEQUE","LETAL","LIDAR","LIMAO","LINFA","LINHO","LIXAR","LONGE","LUGAR",
  "LUNAR","LUTAR","MACRO","MAGNA","MAGOA","MAIOR","MALHA","MALVA","MAMAO",
  "MANHA","MARCO","MARES","MASSA","MATIZ","MELAO","MENOR","MERCA","METAL",
  "METRO","MILHO","MINAR","MISSA","MISTO","MOEDA","MOLDE","MOLHO","MONTE",
  "MORAL","MORSA","MORTO","MOSCA","MOTEL","MOTIM","MOTOR","MULTA","MUNDO",
  "MUSGO","NACAO","NADAR","NAIPE","NEGRO","NINHO","NIVEL","NOBRE","NOITE",
  "NORTE","NOTAR","ODEIA","OLHAR","OLIVA","OPTAR","ORDEM","ORFAO","ORGIA",
  "OTIMO","OUVIR","PACTO","PADRE","PALCO","PALHA","PALMO","PAPEL","PARDA",
  "PARDO","PARIR","PASMO","PASTA","PECAR","PEITO","PENAS","PESCA","PESOS",
  "PICAR","PILHA","PINGO","PISAR","PLANO","PLENO","POLVO","PONCO","PONTE",
  "PORTA","PORTE","POTRO","PRAZO","PRIMA","PRIMO","PROVA","PULGA","PUNHO",
  "PURGA","RACHA","RAIOS","RAIVA","RANHO","RASGO","RASPA","RATOS","RAZAO",
  "REDEA","REGIO","REINO","RENDA","REPOR","REZAR","RIGOR","RISCA","RITMO",
  "ROLAR","RONCO","ROSCA","ROSTO","ROUBO","RUGIR","RUIDO","RURAL","SABAO",
  "SABRE","SAGAZ","SALDO","SALMO","SALVO","SECAO","SENAO","SENSO","SERVO",
  "SIGLA","SIGNO","SINAL","SOBRE","SOLAR","SOLTO","SOMAR","SOPRO","SORTE",
  "SUAVE","SULCO","SUMIR","SURDO","SURTO","TACTO","TALCO","TALHA","TALHO",
  "TANGO","TAPIR","TARDE","TASCA","TEMIA","TEMPO","TENOR","TERCA","TERCO",
  "TERMO","TERRA","TIGRE","TINTO","TIRAR","TOCAR","TOMBO","TOQUE","TORCE",
  "TORDO","TORTO","TOSCO","TOTAL","TOTEM","TRAPO","TREVO","TRIBO","TRIGO",
  "TROCO","TRONO","TROTE","TUMOR","TURMA","TURNO","TUTOR","UNIAO","USINA",
  "VAGAR","VALOR","VALSA","VAPOR","VARAL","VERDE","VERGA","VERSO","VICIO",
  "VIGOR","VIOLA","VIRAR","VISOR","VISTA","VOTAR","VULTO","ZINCO","ZOMBA",
];