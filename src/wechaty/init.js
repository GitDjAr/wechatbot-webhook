const { version } = require('../../package.json')
const { WechatyBuilder } = require('wechaty')
const { SystemEvent } = require('../utils/msg.js')
const Service = require('../service')
const { gptSendMsg } = require('../service/chatgpt/index')
const Utils = require('../utils/index')
const chalk = require('chalk')
const {
  memoryCardName,
  logOutUnofficialCodeList,
  config: { localUrl }
} = require('../config/const')
const token = Service.initLoginApiToken()
const cacheTool = require('../service/cache')
const bot =
  process.env.DISABLE_AUTO_LOGIN === 'true'
    ? WechatyBuilder.build()
    : WechatyBuilder.build({
        name: memoryCardName
      })

module.exports = function init() {
  /** @type {import('wechaty').Contact} */
  let currentUser
  let botLoginSuccessLastTime = false

  console.log(chalk.blue(`🤖 wechatbot-webhook v${version} 🤖`))

  // 启动 Wechaty 机器人
  bot
    // 扫码登陆事件
    .on('scan', (qrcode) => {
      Utils.logger.info('✨ 扫描以下二维码以登录 ✨')
      require('qrcode-terminal').generate(qrcode, { small: true })
      Utils.logger.info(
        [
          'Or Access the URL to login: ' +
            chalk.cyan(`${localUrl}/login?token=${token}`)
        ].join('\n')
      )
    })

    // 登陆成功事件
    .on('login', async (user) => {
      Utils.logger.info('🌱 ' + chalk.green(`User ${user} logged in`))
      Utils.logger.info(
        '💬 ' +
          `你的推消息 api 为：${chalk.cyan(
            `${localUrl}/webhook/msg/v2?token=${token}`
          )}`
      )
      Utils.logger.info(
        '📖 发送消息结构 API 请参考: ' +
          `${chalk.cyan(
            'https://github.com/danni-cool/wechatbot-webhook?tab=readme-ov-file#%EF%B8%8F-api'
          )}\n`
      )

      currentUser = user
      botLoginSuccessLastTime = true

      Service.sendMsg2RecvdApi(new SystemEvent({ event: 'login', user })).catch(
        (e) => {
          Utils.logger.error('上报login事件给 RECVD_MSG_API 出错', e)
        }
      )
    })

    // 登出事件
    .on('logout', async (user) => {
      /** bugfix: 重置登录会触发多次logout，但是上报只需要登录成功后登出那一次 */
      if (!botLoginSuccessLastTime) return

      botLoginSuccessLastTime = false

      Utils.logger.info(chalk.red(`User ${user.toString()} logout`))

      // 登出时给接收消息api发送特殊文本
      Service.sendMsg2RecvdApi(
        new SystemEvent({ event: 'logout', user })
      ).catch((e) => {
        Utils.logger.error('上报 logout 事件给 RECVD_MSG_API 出错：', e)
      })
    })

    .on('room-topic', async (room, topic, oldTopic, changer) => {
      Utils.logger.info(
        `Room ${await room.topic()} topic changed from ${oldTopic} to ${topic} by ${changer.name()}`
      )
    })

    // 群加入
    .on('room-join', async (room, inviteeList, inviter) => {
      Utils.logger.info(
        `Room ${await room.topic()} ${inviter} invited ${inviteeList} to join this room`
      )
      cacheTool.get('room', room.id) && cacheTool.del('room', room.id)
    })

    // 人员离开群（如果有人自行离开房间，微信不会注意到房间里的其他人，）
    .on('room-leave', async (room, leaver) => {
      Utils.logger.info(
        `Room ${await room.topic()} ${leaver} leaved from this room`
      )
      cacheTool.get('room', room.id) && cacheTool.del('room', room.id)
    })

    // 收到消息事件
    .on('message', async (message) => {
      const msg = message.toString()
      const obj = Utils.msgFormat(msg)
      // // @ts-ignore
      const list = ['test', '潜']
      if (
        list.includes(obj?.roomName || '')
        // excludeList.includes(obj?.roomName)
      ) {
        console.log(
          '🚀 ~ .on ~ message:',
          Utils.msgFormat(msg),
          msg,
          obj,
          message,
          message.room()
        )

        Utils.logger.info(`Message: ${msg}`)
        const opt = await gptSendMsg(msg.split('>]')[1])

        console.log(
          '🚀 ~ .on ~ opt:',
          opt,
          list.includes(obj?.roomName || '')
          // message.payload.roomId ===
          //   '@@667493f8093518924f06dd6635a18ca9ae9af933857339fe566ae43b69ffa10b'
        )
        message.say(opt.msg)
      }
      const contact = message.talker()
      const text = message.text()
      const room = message.room()
      if (room) {
        const topic = await room.topic()
        console.log(`Room: ${topic} Contact: ${contact.name()} Text: ${text}`)
      } else {
        console.log(`Contact: ${contact.name()} Text: ${text}`)
      }
      Service.onRecvdMessage(message, bot).catch((e) => {
        Utils.logger.error('向 RECVD_MSG_API 上报 message 事件出错：', e)
      })
    })

    // 收到加好友请求事件
    .on('friendship', async (friendship) => {
      await Service.onRecvdFriendship(friendship, bot)
    })

    // 各种出错事件
    .on('error', async (error) => {
      Utils.logger.error(`\n${chalk.red(error)}\n`)

      if (!bot.isLoggedIn) return

      // wechaty 未知的登出状态，处理异常错误后的登出上报
      if (
        logOutUnofficialCodeList.some((item) => error.message.includes(item))
      ) {
        await bot.logout()
      }

      // 发送error事件给接收消息api
      Service.sendMsg2RecvdApi(
        new SystemEvent({ event: 'error', error, user: currentUser })
      ).catch((e) => {
        Utils.logger.error('上报 error 事件给 RECVD_MSG_API 出错：', e)
      })
    })

  bot.start().catch((e) => {
    Utils.logger.error('bot 初始化失败：', e)
  })

  return bot
}
