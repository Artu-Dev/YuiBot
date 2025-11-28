import { REST, Routes } from 'discord.js';

const commands = [
  {
    name: 'entrar',
    description: 'entra na call!',
  },
  {
    name: 'sair',
    description: 'SAi da call',
  },
  {
    name: 'charinfo',
    description: 've quantos caracteres voce tem',
  },
];

const rest = new REST({ version: '10' }).setToken("MTE2NzMwODMzNzc2ODAzODQ5MQ.Gf97LL.sepRGABhyaInJQxBT90SOAiRUsn401KVkUBdRo");

(async () => {
  try {
    console.log('Iniciando o registro de comandos...');

    await rest.put(Routes.applicationCommands("1167308337768038491"), { body: commands });

    console.log('Comandos registrados com sucesso!');
  } catch (error) {
    console.error(error);
  }
})();
