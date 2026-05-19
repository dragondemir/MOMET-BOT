import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { Command } from './structures/Command';
import { Button } from './structures/Button';
import { Menu } from './structures/Menu';
import { logger } from './utils/logger';
import { PresenceManager } from './utils/presenceManager';

export class BotClient extends Client {
  public commands: Collection<string, Command> = new Collection();
  public buttons: Collection<string, Button> = new Collection();
  public menus: Collection<string, Menu> = new Collection();
  public aliases: Collection<string, string> = new Collection();
  public noPrefixUsers: Set<string> = new Set();
  public commandBlacklist: Set<string> = new Set();
  public guildPrefixes: Collection<string, string> = new Collection();
  public presenceManager?: PresenceManager;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.on('disconnect', () => {
      logger.warn('Bot disconnected from Discord');
    });

    this.on('reconnecting', () => {
      logger.info('Bot reconnecting to Discord...');
    });

    this.on('error', (error) => {
      logger.error('Discord client error', error);
    });
  }

  override async login(token: string): Promise<string> {
    logger.info('Logging in to Discord...');
    const result = await super.login(token);
    return result;
  }
}