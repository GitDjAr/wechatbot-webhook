const fetch = require('node-fetch-commonjs')

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
async function gptSendMsg(msg) {
  const options = await gptMsg(msg)
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify(options),
    headers: { 'Content-Type': 'application/json' }
  })

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`)
  }

  // 确保响应是可读流
  if (!res.body) {
    throw new Error('Response body is not readable')
  }

  let fullResponse = ''

  // 创建一个函数来处理每个数据块
  const processChunk = (chunk) => {
    const chunkText = chunk.toString().trim()
    if (chunkText) {
      try {
        const jsonChunk = JSON.parse(chunkText)
        if (jsonChunk.response) {
          fullResponse += jsonChunk.response
          console.log('Partial response:', jsonChunk.response)
        }
      } catch (error) {
        console.error('Error parsing chunk:', error)
      }
    }
  }

  // 使用 for await...of 循环来读取流
  for await (const chunk of res.body) {
    processChunk(chunk)
  }

  console.log('Full response:', fullResponse)
  return fullResponse
}

// 使用示例
gptSendMsg('Your message here')
  .then((response) => console.log('Final response:', response))
  .catch((error) => console.error('Error:', error))
