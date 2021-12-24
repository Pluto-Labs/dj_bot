const Discord = require("discord.js")
require('dotenv').config()
const { prefix, token } = process.env
const ytsr = require('ytsr')
const ytdl = require("ytdl-core-discord")
const youtubeThumbnail = require('youtube-thumbnail')
const player = require('discordjs-ytdl-advanced')

const client = new Discord.Client()

const queue = new Map()

client.once("ready", () => {
  console.log("Ready!")
})

client.once("reconnecting", () => {
  console.log("Reconnecting!")
})

client.once("disconnect", () => {
  console.log("Disconnect!")
})

client.on("message", async message => {
  if (message.author.bot) return
  if (!message.content.startsWith(prefix)) return

  const serverQueue = queue.get(message.guild.id)

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue)
    return
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue)
    return
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue)
    return
  } else if (message.content.startsWith(`${prefix}queue`)) {
    getQueue(message, serverQueue)
    return
  } else if (message.content.startsWith(`${prefix}remove`)) {
    remove(message, serverQueue)
  } else if (message.content.startsWith(`${prefix}shuffle`)) {
    shuffle(message, serverQueue)
  }
})

async function execute(message, serverQueue) {
  try {
    const args = message.content.split(" ")

    const voiceChannel = message.member.voice.channel

    if (!voiceChannel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    const permissions = voiceChannel.permissionsFor(message.client.user)

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send(
        "Preciso de permissão para entrar e falar no seu canal de voz!"
      )
    }

    if (!args[1]) {
      return message.channel.send(
        "Comando incompleto!"
      )
    }

    var songInfo
    var song = {}
    var toSearch

    if (args[1].includes('youtube.com')) {
      console.time("YOUTUBE")
      songInfo = await ytdl.getInfo(args[1])

      song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        channel: songInfo.videoDetails.ownerChannelName,
        duration: songInfo.videoDetails.lengthSeconds,
      }
      console.timeEnd("YOUTUBE")
      console.log("song (youtube) === ", song)
    } else {
      console.time("DEFAULT")
      if (args.length <= 2) {
        toSearch = args[1]
      } else {
        toSearch = args.filter((arg, index) => index > 0).join(' ')
      }

      if (toSearch.includes('spotify.com')) {
        songInfo = await (await player(toSearch)).data
      } else {
        songInfo = await (await ytsr(toSearch, { limit: 1 })).items[0]
        songInfo.seconds = songInfo.duration.split(':').reduce((acc, time) => (60 * acc) + +time)
      }
      console.log("songInfo === ", songInfo)
      song = {
        title: songInfo.title,
        url: songInfo.url,
        channel: songInfo.author.name,
        duration: songInfo.seconds,
      }
      console.timeEnd("DEFAULT")
      console.log("song (default) === ", song)
    }

    if (!serverQueue) {
      const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true
      }

      queue.set(message.guild.id, queueContruct)

      queueContruct.songs.push(song)

      var connection = await voiceChannel.join()

      queueContruct.connection = connection
      queueContruct.connection.voice.setSelfDeaf(true)

      play(message.guild, queueContruct.songs[0])

      message.channel.send("**Playing** 🎶 `" + queueContruct.songs[0].title + "` - Now!")
    } else {

      const thumbnail = await youtubeThumbnail(song.url)

      const songDuration = new Date(1000 * song.duration).toISOString().substr(11, 8).replace(/^[0:]+/, "")
      const estimatedSecondsToPlay = serverQueue.songs.map(song => song.duration).reduce((acc, curr) => parseInt(acc) + parseInt(curr), 0)
      const estimatedTimeToPlay = new Date(1000 * estimatedSecondsToPlay).toISOString().substr(11, 8).replace(/^[0:]+/, "")

      const messageEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(song.title)
        .setURL(song.url)
        .setThumbnail(thumbnail.default.url)
        .setAuthor('Added to queue')
        .addFields(
          { name: 'Channel', value: song.channel, inline: true },
          { name: 'Song Duration', value: songDuration, inline: true },
          { name: 'Estimated time until playing', value: estimatedTimeToPlay, inline: true },
          { name: 'Position in queue', value: serverQueue.songs.length, inline: true },
        )

      serverQueue.songs.push(song)

      message.channel.send("**Searching** 🔎 `" + toSearch + "`")
      message.channel.send(messageEmbed)
    }
  } catch (error) {
    console.log('error on execute === ', error)
  }
}

function shuffle(message, serverQueue) {
  try {
    if (!message.member.voice.channel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    if (!serverQueue || serverQueue.songs.length <= 1) {
      return message.channel.send("Não há nenhuma música na fila para embaralhar!")
    }

    const playingNow = serverQueue.songs[0]
    const shuffledList = serverQueue.songs.filter((song, index) => index > 0).sort(() => Math.random() - 0.5)

    serverQueue.songs = [playingNow].concat(shuffledList)
    message.channel.send("🔀 Shuffled 👍")
  } catch (error) {
    console.log("error on shuffle === ", error)
  }
}

function remove(message, serverQueue) {
  try {
    if (!message.member.voice.channel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    if (!serverQueue || serverQueue.songs.length <= 1) {
      return message.channel.send("Não há nenhuma música na fila para ser removida!")
    }

    const args = message.content.split(" ")

    if (!args[1]) {
      return message.channel.send(
        "Comando incompleto!"
      )
    }

    const indexToRemove = parseInt(args[1])

    if (indexToRemove <= serverQueue.songs.length && indexToRemove != 0) {
      const songToRemove = serverQueue.songs[indexToRemove]
      serverQueue.songs = serverQueue.songs.filter((song, index) => index !== indexToRemove)
      message.channel.send("✅ Removed `" + songToRemove.title + "`")
    }

  } catch (error) {
    console.log("error on remove === ", error)
  }
}

function getQueue(message, serverQueue) {
  try {

    if (!message.member.voice.channel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    if (!serverQueue) {
      return message.channel.send("Não há nenhuma música na fila!")
    }

    const currentSong = serverQueue.songs[0]

    const thumbnail = youtubeThumbnail(currentSong.url)

    const queueList = []
    var queueNext = ''

    serverQueue.songs.forEach((song, index) => {
      if (index === 0) {
        queueList.push({ name: '__*Now Playing:*__', value: `[${song.title}](${song.url})`, inline: false })
      } else {
        queueNext = queueNext.concat("`" + index + ".` [" + song.title + "](" + song.url + ") \n\n")
      }
      if (index + 1 === serverQueue.songs.length && serverQueue.songs.length > 1) {
        queueList.push({ name: '__*Up Next:*__', value: queueNext, inline: false })
      }
    })

    const messageEmbed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle("Queue now")
      .setThumbnail(thumbnail.default.url)
      .addFields(queueList)

    message.channel.send(messageEmbed)
  } catch (error) {
    console.log("error on queue === ", error)
  }
}

function skip(message, serverQueue) {
  try {
    if (!message.member.voice.channel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    if (!serverQueue) {
      return message.channel.send("Não há música para pular!")
    }

    message.channel.send("⏩ Skipped 👍")

    serverQueue.connection.dispatcher.end()
  } catch (error) {
    console.log("error on skip === ", error)
  }
}

function stop(message, serverQueue) {
  try {
    if (!message.member.voice.channel) {
      return message.channel.send(
        "Você precisa estar em um canal de voz para tocar música!"
      )
    }

    if (!serverQueue) {
      return message.channel.send("Não há música para parar!")
    }

    serverQueue.songs = []
    serverQueue.connection.dispatcher.end()
  } catch (error) {
    console.log("error on stop === ", error)
  }
}

async function play(guild, song) {
  try {
    const serverQueue = queue.get(guild.id)

    if (!song) {
      serverQueue.voiceChannel.leave()
      queue.delete(guild.id)
      return
    }

    const dispatcher = serverQueue.connection
      .play(await ytdl(song.url, { filter: "audioonly" }), { type: 'opus' })
      .on("finish", () => {

        if (serverQueue.voiceChannel.members.size <= 1) {
          serverQueue.voiceChannel.leave()
          queue.delete(guild.id)
          return
        }

        serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
      })
      .on("error", error => console.log(error))
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

  } catch (error) {
    console.log("error on play === ", error)
  }
}

client.login(token)