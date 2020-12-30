const client = require('./client')
const { createJournals } = require('./dev-journal')


const { ASANA_PROJECT = '1152701043959235', BACKOFF = 30 } = process.env

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const markPastDue = (project = ASANA_PROJECT) => client.projects.tasks(project, {
  completed_since: 'now',
  opt_fields: 'due_on,due_at,completed',
}).then(({ data }) => {
  const marks = data
    .filter((t) => new Date(`${t.due_at ? t.due_at : `${t.due_on}T23:59:59.999Z`}`) < new Date())
    .map(({ gid }) => client.tasks.update(gid, { completed: true }))
  return Promise.all(marks)
})

const runner = async (time = 0) => {
  const [project = ASANA_PROJECT] = process.argv.slice(2)
  const backoff = parseInt(BACKOFF * (time + 1))
  try {
    await markPastDue(project)
    await createJournals(project)
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
