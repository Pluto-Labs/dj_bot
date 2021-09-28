const Discord = require("discord.js");
require('dotenv').config()
const { prefix, token } = process.env;
const ytdl = require("ytdl-core");
const youtubeThumbnail = require('youtube-thumbnail');

const client = new Discord.Client();

const queue = new Map();

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}queue`)) {
    getQueue(message, serverQueue);
    return;
  } /*else {
    message.channel.send("Você precisa inserir um comando válido!");
  }*/
});

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "Você precisa estar em um canal de voz para tocar música!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "Preciso das permissões para entrar e falar no seu canal de voz!"
    );
  }

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
  };

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      queueContruct.connection.voice.setSelfDeaf(true);
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {

    const thumbnail = await youtubeThumbnail(song.url)

    const messageEmbed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle(song.title)
      .setURL(song.url)
      .setThumbnail(thumbnail.default.url)
      .setAuthor('Added to queue')
      .addFields(
        { name: 'Position in queue', value: serverQueue.songs.length, inline: true },
      )
    serverQueue.songs.push(song)
    message.channel.send("**Searching** 🔎 `"+song.url+"`");
    message.channel.send(messageEmbed)
  }
}

function getQueue(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você tem que estar em um canal de voz para parar a música!"
    );
  if (!serverQueue)
    return message.channel.send("Não há música na queue!");
  
  var queueList = '```'

  serverQueue.songs.forEach((song, index) => {
    queueList = queueList.concat(index + " - " + song.title+"\n")
    if(index+1 === serverQueue.songs.length){
      queueList = queueList.concat("```")
      message.channel.send(queueList)
    }
  });
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você tem que estar em um canal de voz para parar a música!"
    );
  if (!serverQueue)
    return message.channel.send("Não há música que eu possa pular!");
  message.channel.send("⏩ Skipped 👍")
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "Você tem que estar em um canal de voz para parar a música!"
    );

  if (!serverQueue)
    return message.channel.send("Não há música que eu possa parar!");

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send("**Playing** 🎶 `"+song.title+"` - Now!");
}

client.login(token);