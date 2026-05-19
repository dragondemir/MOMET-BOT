import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { BotClient } from './client';
import { logger } from './utils/logger';
import { loadCommands, commands, deployCommands } from './commands';
import { loadButtons, buttons } from './components/buttons';
import { loadMenus, menus } from './components/menus';
import { loadEvents } from './events';
import { connectDatabase } from './services/database';

const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
    res.send('MOMET Bot active with Cloudflare WARP.');
});

app.listen(PORT, () => {
    console.log(`[INFO] Hugging Face Port ${PORT} opened immediately.`);
});

// --- CLOUDFLARE WARP SANSÜR KIRICI (GÜVENLİ VE KALICI) ---
// Docker üzerinde başlattığımız resmi Cloudflare proxy adresine bağlanıyoruz
const proxyUrl = 'http://127.0.0.1:40001'; 
let undiciProxyAgent: ProxyAgent | null = null;

try {
    undiciProxyAgent = new ProxyAgent({
        uri: proxyUrl,
        connect: { timeout: 30000 }
    });
    
    setGlobalDispatcher(undiciProxyAgent);
    logger.info('🚀 Undici Global Dispatcher Cloudflare WARP tüneline kilitlendi.');
} catch (e) {
    logger.error('WARP Dispatcher ayarlanırken hata oluştu:', e);
}

process.env.HTTP_PROXY = proxyUrl;
process.env.HTTPS_PROXY = proxyUrl;
// --------------------------------------------------------

const client = new BotClient();

if (undiciProxyAgent) {
    (client.rest as any).agent = undiciProxyAgent;
}
client.rest.setToken(process.env.DISCORD_TOKEN!);

loadCommands();
client.commands = commands;

loadButtons(client);
client.buttons = buttons;

loadMenus(client);
client.menus = menus;

loadEvents(client);

connectDatabase().catch((error) => {
    logger.error('Failed to connect to database', error);
});

async function startBot() {
    try {
        logger.info('🚀 Cloudflare WARP hattı devrede. Discord\'a giriş yapılıyor...');
        
        await client.login(process.env.DISCORD_TOKEN);
        logger.info('✅ Discord bağlantısı başarılı! MOMET Bot AKTİF.');

        logger.info('🔄 Slash komutları arka planda senkronize ediliyor...');
        deployCommands().catch((err) => {
            logger.error('❌ Arka plan deploy işlemi başarısız:', err);
        });
        
    } catch (error) {
        console.error('❌ LOGIN DETAYLI HATA RAPORU:', error);
    }
}

startBot();

process.on('unhandledRejection', (error: Error) => {
    logger.error('Unhandled Promise Rejection', error);
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
});