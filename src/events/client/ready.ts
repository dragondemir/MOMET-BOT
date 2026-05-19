import { Client, ChannelType, VoiceChannel } from 'discord.js';
import { Shoukaku, Connectors } from 'shoukaku'; // Müzik motoru import edildi
import { Event } from '../../structures/Event';
import { logger } from '../../utils/logger';
import { webhookService } from '../../services/webhookService';
import { BotClient } from '../../client';
import { User, Guild, getAllRooms, deleteRoom } from '../../models';
import CmdBlacklistCommand from '../../commands/owners/cmdblacklist';
import { PresenceManager } from '../../utils/presenceManager';
import { isDatabaseConnected, waitForDatabaseConnection } from '../../services/database';
import { registerCommands } from '../../services/commandRegistration';
import mongoose from 'mongoose';

export default class ReadyEvent extends Event<'ready'> {
  constructor() {
    super({
      name: 'ready',
      once: true,
    });
  }

  async execute(client: Client<true>) {
    const botClient = client as BotClient;

    logger.info(`✅ Logged in as ${client.user.tag}!`);
    logger.info(`📊 Bot is in ${client.guilds.cache.size} guilds`);
    logger.info(`👥 Bot is serving ${client.users.cache.size} users`);
    logger.info(`🔌 Loaded ${botClient.commands.size} commands`);
    logger.info(`🔘 Loaded ${botClient.buttons.size} buttons`);
    logger.info(`📋 Loaded ${botClient.menus.size} menus`);

    // Automatically register slash commands with Discord API
    try {
      await registerCommands();
      logger.info('✅ Slash commands registration completed');
    } catch (error) {
      logger.error('Failed to register slash commands:', error instanceof Error ? error : undefined);
      logger.warn('Bot will continue running, but slash commands may not be available until registration succeeds');
    }

    // Initialize noPrefix users (only if database is connected)
    try {
      // Wait for database connection (with 15 second timeout)
      const dbConnected = await waitForDatabaseConnection(15000);
      
      if (!dbConnected) {
        logger.warn('Database not connected, skipping no-prefix users initialization');
        logger.warn('Bot will continue to work, but no-prefix features may not be available');
      } else {
        // Check connection state one more time before querying
        if (mongoose.connection.readyState === 1) {
          const noPrefixUsers = await User.find({ noPrefix: true }).select('discordId').lean();
          botClient.noPrefixUsers.clear();
          for (const user of noPrefixUsers) {
            if (user.discordId) {
              const trimmedId = user.discordId.trim();
              botClient.noPrefixUsers.add(trimmedId);
              logger.debug(`[NOPREFIX] Added user to Set: ${trimmedId}`);
            } else {
              logger.warn(`[NOPREFIX] User found with noPrefix=true but missing discordId: ${JSON.stringify(user)}`);
            }
          }
          logger.info(`✅ Loaded ${botClient.noPrefixUsers.size} no-prefix users`);
          if (botClient.noPrefixUsers.size > 0) {
            const sampleIds = Array.from(botClient.noPrefixUsers).slice(0, 3);
            logger.debug(`[NOPREFIX] Sample loaded IDs: ${JSON.stringify(sampleIds)}`);
          }
        } else {
          logger.warn('Database connection state is not ready, skipping no-prefix users initialization');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to load no-prefix users');
    }

    // Load guild prefixes into cache (only if database is connected)
    try {
      if (mongoose.connection.readyState === 1) {
        const guildsWithPrefixes = await Guild.find({ prefix: { $exists: true, $ne: null } })
          .select('discordId prefix')
          .lean()
          .catch(() => []);
        
        botClient.guildPrefixes.clear();
        for (const guild of guildsWithPrefixes) {
          if (guild.discordId && guild.prefix) {
            botClient.guildPrefixes.set(guild.discordId, guild.prefix);
          }
        }
        logger.info(`✅ Loaded ${botClient.guildPrefixes.size} guild prefixes into cache`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to load guild prefixes');
    }

    // Initialize command blacklist (only if database is connected)
    try {
      if (isDatabaseConnected()) {
        await CmdBlacklistCommand.initializeBlacklist(botClient);
      } else {
        logger.warn('Database not connected, skipping command blacklist initialization');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize command blacklist');
    }

    // Send connection webhook
    webhookService.sendConnectionLog(
      `Bot connected successfully!\n**Tag:** ${client.user.tag}\n**Guilds:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}\n**Commands:** ${botClient.commands.size}\n**Buttons:** ${botClient.buttons.size}\n**Menus:** ${botClient.menus.size}`,
      'connect'
    );

    // Initialize and start presence manager
    try {
      const presenceManager = new PresenceManager(botClient, 60000);
      botClient.presenceManager = presenceManager;
      presenceManager.start();
      logger.info('[PRESENCE] Presence manager initialized and started');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize presence manager');
    }

    // Cleanup VoiceMaster rooms on restart (only if database is connected)
    try {
      if (isDatabaseConnected()) {
        await this.cleanupVoiceMasterRooms(client);
      } else {
        logger.warn('Database not connected, skipping VoiceMaster rooms cleanup');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to cleanup VoiceMaster rooms');
    }

    logger.info('🚀 Bot is ready and operational!');

    // --- EN SONDA SES MOTORUNU GÜVENLİ ŞEKİLDE ATEŞLİYORUZ ---
    try {
      logger.info('[LAVALINK] Shoukaku ses motoru bağlantısı başlatılıyor...');
      const Nodes = [{
        name: 'MOMET-Lavalink',
        url: `${process.env.LAVALINK_HOST || 'lavalink.lexarn.xyz'}:${process.env.LAVALINK_PORT || '443'}`,
        auth: process.env.LAVALINK_PASSWORD || 'lexarn.xyz',
        secure: process.env.LAVALINK_SECURE === 'true' || true
      }];

      botClient.manager = new Shoukaku(new Connectors.DiscordJS(botClient), Nodes);

      botClient.manager.on('ready', (name) => logger.info(`[LAVALINK] ${name} ses sunucusuna başarıyla bağlanıldı!`));
      botClient.manager.on('error', (name, error) => logger.error(`[LAVALINK] ${name} sunucusunda hata oluştu:`, error));
      botClient.manager.on('close', (name, code, reason) => logger.warn(`[LAVALINK] ${name} bağlantısı kapandı. Kod: ${code}, Sebep: ${reason}`));
    } catch (shoukakuError) {
      logger.error('[LAVALINK] Shoukaku kurulurken bir hata meydana geldi:', shoukakuError);
    }
    // --------------------------------------------------------
  }

  /**
   * Clean up VoiceMaster rooms on bot restart
   * Deletes orphaned database entries and empty channels
   */
  private async cleanupVoiceMasterRooms(client: Client<true>): Promise<void> {
    try {
      const rooms = await getAllRooms();
      if (rooms.length === 0) {
        logger.info('[VOICEMASTER] No rooms to cleanup');
        return;
      }

      logger.info(`[VOICEMASTER] Cleaning up ${rooms.length} rooms...`);
      let deletedCount = 0;
      let orphanedCount = 0;

      for (const room of rooms) {
        try {
          const guild = client.guilds.cache.get(room.guildId);
          if (!guild) {
            await deleteRoom(room.channelId);
            orphanedCount++;
            continue;
          }

          const channel = await guild.channels.fetch(room.channelId).catch(() => null);
          
          if (!channel) {
            await deleteRoom(room.channelId);
            orphanedCount++;
            continue;
          }

          if (channel.type !== ChannelType.GuildVoice) {
            await deleteRoom(room.channelId);
            orphanedCount++;
            continue;
          }

          const voiceChannel = channel as VoiceChannel;
          
          if (voiceChannel.members.size === 0) {
            try {
              const botMember = await guild.members.fetch(guild.client.user.id).catch(() => null);
              if (!botMember) continue;

              const permissions = voiceChannel.permissionsFor(botMember);
              if (!permissions?.has('ManageChannels')) {
                await deleteRoom(room.channelId);
                orphanedCount++;
                continue;
              }

              await voiceChannel.delete('Bot restart cleanup - empty room');
              await deleteRoom(room.channelId);
              deletedCount++;
            } catch (deleteError) {
              const channelStillExists = await guild.channels.fetch(room.channelId).catch(() => null);
              if (!channelStillExists) {
                await deleteRoom(room.channelId);
                orphanedCount++;
              }
            }
          }
        } catch (error) {
          try {
            await deleteRoom(room.channelId);
            orphanedCount++;
          } catch (deleteError) {}
        }
      }

      logger.info(
        `[VOICEMASTER] Cleanup complete: ${deletedCount} empty rooms deleted, ${orphanedCount} orphaned entries removed`
      );
    } catch (error) {
      logger.error('[VOICEMASTER] Error during room cleanup:', error);
    }
  }
}