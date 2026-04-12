import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();

// Import all command data
import { data as addChannelData } from './commands/addChannel.js';
import { data as ajudaConqsData } from './commands/ajudaConqs.js';
import { data as calarData } from './commands/calar.js';
import { data as charsData } from './commands/chars.js';
import { data as classeData } from './commands/classe.js';
import { data as configData } from './commands/config.js';
import { data as conqsData } from './commands/conqs.js';
import { data as doarData } from './commands/pix.js';
import { data as entrarData } from './commands/entrar.js';
import { data as escudoData } from './commands/escudo.js';
import { data as newsData } from './commands/news.js';
import { data as palavraData } from './commands/palavra.js';
import { data as penalityData } from './commands/penality.js';
import { data as pingData } from './commands/ping.js';
import { data as rankData } from './commands/rank.js';
import { data as removeChannelData } from './commands/removeChannel.js';
import { data as removePenalityData } from './commands/remove-penality.js';
import { data as roubarData } from './commands/roubar.js';
import { data as sairData } from './commands/sair.js';
import { data as setPenalityData } from './commands/set-penality.js';
import { data as statsData } from './commands/stats.js';
import { data as tigreData } from './commands/tigre.js';
import { data as crashData } from './commands/crash.js';
import { data as eventoData } from './commands/evento.js';

const commands = [
  addChannelData,
  ajudaConqsData,
  calarData,
  charsData,
  classeData,
  configData,
  conqsData,
  doarData,
  entrarData,
  escudoData,
  newsData,
  palavraData,
  penalityData,
  pingData,
  rankData,
  removeChannelData,
  removePenalityData,
  roubarData,
  sairData,
  setPenalityData,
  statsData,
  tigreData,
  crashData,
  eventoData,
  
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos globais...');

    await rest.put(
      Routes.applicationCommands("1167308337768038491"),
      { body: commands }
    );

    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
