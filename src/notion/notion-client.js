const { Client, LogLevel } = require('@notionhq/client')


const { NOTION_TOKEN } = process.env

module.exports = new Client({
  auth: NOTION_TOKEN,
  logLevel: LogLevel.DEBUG,
})
