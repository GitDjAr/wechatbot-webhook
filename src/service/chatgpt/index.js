// @ts-nocheck
const fs = require('fs').promises
const { pipeline } = require('node:stream').promises
const fetch = require('node-fetch-commonjs')
/**
 * 读取文件 上下文
 * @author wangfupeng
 * @date 2022-10-20
 * @param  {string} msg 消息
 * return Array<{role:string, content:string}>
 */
async function readContext(id) {
  if (id) {
    // return await fs.readFile(`./cache/${id}.txt`, 'utf-8')
    // const data = await fs.readFile(
    //   `../../../../log/app.2024-06-24.log`,
    //   'utf-8'
    // )
    return [
      {
        role: 'user',
        content: '之后我问的所有问题。都使用无奈的语气,语言使用中文回答'
      }
    ]
  }
  return []
  // TODO
}

/**
 * chatgpt service
 * @author wangfupeng
 * @date 2022-10-20
 * @param  {string} msg 消息
 * @param  {object} options 选项
 * @returns promise
 */
async function gptMsg(msg) {
  const options = {
    model: 'llama3:latest',
    keep_alive: '5m',
    options: {},
    messages: await readContext(msg)
  }
  //msg  /t数据
  msg?.slice(2)
  options.messages.push({ role: 'user', content: msg })
  return options
}
async function gptSendMsg(msg = '') {
  if (!msg) return
  try {
    const options = await gptMsg(msg)
    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      body: JSON.stringify(options),

      headers: { 'Content-Type': 'application/json' }
    })
    const data = { msg: '' }
    if (res.ok) {
      for await (const chunk of res.body) {
        // console.log('🚀 ~ gptSendMsg ~ chunk:', chunk)
        let obj = JSON.parse(chunk.toString())
        const { message, done } = obj
        data.msg += message.content
        if (done) {
          Object.assign(data, obj)
          delete data.model
          delete data.created_at
          delete data.message
        }
      }
      console.log(data)
      return data
    }
  } catch (e) {
    console.log(e)
  }
}

// console.log(
//   gptSendMsg('你好').then((res) => {
//     console.log(res, res?.body)
//   })
// )
module.exports = {
  gptMsg,
  gptSendMsg
}
