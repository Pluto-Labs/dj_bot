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
  } else if (message.content.startsWith(`${prefix}remove`)) {
    remove(message, serverQueue)
  }
  /*else {
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
      message.channel.send("**Playing** 🎶 `"+queueContruct.songs[0].title+"` - Now!");
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

function remove(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to remove the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song in queue to remove!");

  const args = message.content.split(" ");
  const indexToRemove = parseInt(args[1])
  
  if(indexToRemove <= serverQueue.songs.length && indexToRemove != 0) {
    const songToRemove = serverQueue.songs[indexToRemove] 
    serverQueue.songs = serverQueue.songs.filter((song, index) => index !== indexToRemove)
    message.channel.send("✅ Removed `"+songToRemove.title+"`")
  }

}

function getQueue(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song in queue!");

  const currentSong = serverQueue.songs[0]

  const thumbnail = youtubeThumbnail(currentSong.url)

  const queueList = []
  var queueNext = ''

  serverQueue.songs.forEach((song, index) => {
    if(index === 0) {
      queueList.push({ name: '__*Now Playing:*__', value: `[${song.title}](${song.url})`, inline: false  })
    } else {
      queueNext = queueNext.concat("`"+index+".` ["+song.title+"]("+song.url+") \n\n")
    }
    if (index+1 === serverQueue.songs.length) {
      queueList.push({ name: '__*Up Next:*__', value: queueNext, inline: false })
    }
  });

  const messageEmbed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle("Queue now")
    .setThumbnail(thumbnail.default.url)
    .addFields(queueList)
  
  message.channel.send(messageEmbed)
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  message.channel.send("⏩ Skipped 👍")
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );

  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");

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

      if(serverQueue.voiceChannel.members.size <= 1) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
      }

      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);