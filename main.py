import discord
import os

client = discord.Client(intents=discord.Intents.default())

@client.event
async def on_ready():
    print(f'Bot {client.user} olarak giriş yaptı!')

# Token'ı birazdan ayarlardan ekleyeceğiz
token = os.getenv("DISCORD_TOKEN")
client.run(token)
