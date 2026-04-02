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
        description: 'Escolha uma penalidade',
        type: 3,
        required: true,
        choices: [
          { name: 'estrangeiro', value: 'estrangeiro' },
          { name: 'palavra_obrigatoria', value: 'palavra_obrigatoria' },
          { name: 'eco', value: 'eco' },
          { name: 'screamer', value: 'screamer' },
          { name: 'poeta_binario', value: 'poeta_binario' },
          { name: 'gago_digital', value: 'gago_digital' },
          { name: 'redigido', value: 'redigido' },
          { name: 'sentido_invertido', value: 'sentido_invertido' },
        ],
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
        choices: [
          { name: 'estrangeiro', value: 'estrangeiro' },
          { name: 'palavra_obrigatoria', value: 'palavra_obrigatoria' },
          { name: 'eco', value: 'eco' },
          { name: 'screamer', value: 'screamer' },
          { name: 'poeta_binario', value: 'poeta_binario' },
          { name: 'gago_digital', value: 'gago_digital' },
          { name: 'redigido', value: 'redigido' },
          { name: 'sentido_invertido', value: 'sentido_invertido' },
          { name: 'all', value: 'all' },
        ],
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
        choices: [
          { name: 'prefix', value: 'prefix' },
          { name: 'random', value: 'random' },
          { name: 'generate', value: 'generate' },
          { name: 'speak', value: 'speak' },
          { name: 'speakmessage', value: 'speakmessage' },
        ],
      },
      {
        name: 'valor',
        description: 'on/off/true/false ou prefixo',
        type: 3,
        required: false,
        choices: [
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
          { name: 'true', value: 'true' },
          { name: 'false', value: 'false' },
        ],
      },
    ],
  },
  {
    name: 'ping',
    description: 'Verifica a latência do bot.',
  },
  {
    name: 'rank',
    description: 'Mostra o top 10 de usuários com mais chars do servidor.',
  },
  {
    name: 'escudo',
    description: 'Compra um escudo de proteção por 24h (custa 300 chars).',
  },
  {
    name: 'ajudaconqs',
    description: 'Mostra a lista de todas as conquistasa disponíveis.',
  },
  {
    name: 'doar',
    description: 'Transfere chars para outro usuário.',
    options: [
      {
        name: 'usuário',
        description: 'Usuário para receber os chars',
        type: 6,
        required: true,
      },
      {
        name: 'quantidade',
        description: 'Quantidade de chars a transferir',
        type: 4,
        required: true,
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
