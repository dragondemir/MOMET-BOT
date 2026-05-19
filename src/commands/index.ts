import { Collection, REST, Routes } from 'discord.js';
import { Command } from '../structures/Command';
import { logger } from '../utils/logger';

// Import all commands
import PingCommand from './general/ping';
import HelpCommand from './general/help';
import InfoCommand from './general/info';
import BanCommand from './admin/ban';
import KickCommand from './admin/kick';
import MuteCommand from './admin/mute';
import SetPrefixCommand from './admin/setprefix';
import VoicemasterCommand from './voicemaster/Voicemaster';
import { loadVoiceCommands, voiceCommands } from './voice';
import { loadOwnerCommands, ownerCommands } from './owners';

export const commands = new Collection<string, Command>();

// Register all commands
const commandClasses = [
  PingCommand,
  HelpCommand,
  InfoCommand,
  BanCommand,
  KickCommand,
  MuteCommand,
  SetPrefixCommand,
  VoicemasterCommand,
];

export function loadCommands(): void {
  commands.clear();

  let loadedCount = 0;
  let errorCount = 0;

  for (const CommandClass of commandClasses) {
    try {
      const command = new CommandClass();
      commands.set(command.name, command);
      logger.info(`Loaded command: ${command.name}`);
      loadedCount++;
    } catch (error) {
      errorCount++;
    }
  }

  try {
    loadVoiceCommands();
    for (const [name, command] of voiceCommands) {
      if (!commands.has(name)) {
        commands.set(name, command);
        loadedCount++;
      }
    }
  } catch (error) {
    errorCount++;
  }

  try {
    loadOwnerCommands();
    for (const [name, command] of ownerCommands) {
      if (!commands.has(name)) {
        commands.set(name, command);
        loadedCount++;
      }
    }
  } catch (error) {
    errorCount++;
  }

  logger.info(`✅ Commands loaded: ${loadedCount} successful, ${errorCount} failed`);
}

/**
 * ⚡ DEPLOY FUNCTION - Tünel Çakışması Engellenmiş Sade Sürüm
 */
export async function deployCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    logger.error('❌ DISCORD_TOKEN veya CLIENT_ID eksik!');
    return;
  }

  // index.ts zaten globalDispatcher kullandığı için buradaki yerel agent kalabalığını sildik.
  // Bu sayede istek Hugging Face sunucusunda askıda kalmayacak.
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const slashCommandsJSON = Array.from(commands.values()).map((command) => {
      return command.build().toJSON();
    });

    logger.info(`[DEPLOY] ${slashCommandsJSON.length} adet slash komutu gönderiliyor...`);

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashCommandsJSON }
      );
      logger.info('✅ Komutlar test sunucusuna başarıyla yüklendi!');
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: slashCommandsJSON }
      );
      logger.info('✅ Komutlar global senkronize edildi!');
    }
  } catch (error) {
    logger.error('❌ Deploy hatası:', error instanceof Error ? error : undefined);
  }
}

export function getCommands(): Collection<string, Command> {
  return commands;
}