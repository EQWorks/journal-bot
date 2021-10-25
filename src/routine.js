const { journalRoutine } = require('./notion')


const { NOTION_JOURNALS = 'dev_journal', BACKOFF = 30 } = process.env

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runner = async (time = 0) => {
  const [project = NOTION_JOURNALS] = process.argv.slice(2)
  const backoff = parseInt(BACKOFF * (time + 1))
  try {
    if (project === 'dev_journal') {
      await journalRoutine()
    }
    process.exit(0)
  } catch (err) {
    // const { response: { status } = {}, message } = err
    // if (status === 429 && time < 3) { // retry on rate limit
    if (time < 3) {
      console.warn(`retry in ${backoff} seconds`)
      await timeout(backoff * 1000)
      await runner(time + 1)
    } else { // fail on other reasons
      console.error(err)
      process.exit(1)
    }
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runner()
}
