import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();

const commands = [
  {
    name: 'entrar',
    description: 'Entra na call!',
  },
  {
    name: 'sair',
    description: 'Sai da call.',
  },
  {
    name: 'chars',
    description: 'Mostra quantos caracteres você ainda tem.',
  },
  {
    name: 'add-channel',
    description: 'Adiciona o canal atual como canal autorizado.',
  },
  {
    name: 'remove-channel',
    description: 'Remove o canal atual da lista de canais autorizados.',
  },
  {
    name: 'stats',
    description: 'Mostra suas estatísticas completas.',
  },
  {
    name: 'conquistas',
    description: 'Mostra suas conquistas desbloqueadas.',
  },
  {
    name: 'news',
    description: 'Gera uma fake news completamente absurda.',
  },
  {
    name: 'palavra',
    description: 'Mostra a palavra proibida do dia.',
  },
  {
    name: 'penality',
    description: 'Verifica suas penalidades ou de um usuário mencionado.',
  },
  {
    name: 'set-penality',
    description: 'Aplica uma penalidade existente em um usuário.',
  },
  {
    name: 'remove-penality',
    description: 'Remove penalidade de um usuário (ou all).',
  },
  {
    name: 'config',
    description: 'Mostra/ajusta configurações do bot.',
  },
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
