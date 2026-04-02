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
    options: [
      {
        name: 'usuário',
        description: 'Mencionar o usuário a ver o saldo',
        type: 6,
        required: false,
      },
    ],
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
    options: [
      {
        name: 'usuário',
        description: 'Mencione outro usuário (opcional)',
        type: 6,
        required: false,
      },
    ],
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
    name: 'roubar',
    description: 'Rouba chars de outra pessoa (ou aleatório).',
    options: [
      {
        name: 'usuário',
        description: 'Usuário alvo (opcional)',
        type: 6,
        required: false,
      },
    ],
  },
  {
    name: 'penality',
    description: 'Verifica suas penalidades ou de um usuário mencionado.',
    options: [
      {
        name: 'usuário',
        description: 'Usuário a verificar as penalidades',
        type: 6,
        required: false,
      },
    ],
  },
  {
    name: 'set-penality',
    description: 'Aplica uma penalidade existente em um usuário.',
    options: [
      {
        name: 'usuário',
        description: 'Usuário a punir',
        type: 6,
        required: true,
      },
      {
        name: 'penalidade',
        description: 'mute, olho, sleep etc',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'remove-penality',
    description: 'Remove penalidade de um usuário (ou all).',
    options: [
      {
        name: 'usuário',
        description: 'Usuário a remover penalidades',
        type: 6,
        required: false,
      },
      {
        name: 'penalidade',
        description: 'Nome da penalidade ou all',
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: 'config',
    description: 'Mostra/ajusta configurações do bot.',
    options: [
      {
        name: 'campo',
        description: 'prefix, random/generate ou speak',
        type: 3,
        required: false,
      },
      {
        name: 'valor',
        description: 'on/off/true/false ou prefixo',
        type: 3,
        required: false,
      },
    ],
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
