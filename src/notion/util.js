const util = require('util')
const notion = require('./notion-client')


const showObject = (obj) => util.inspect(obj, { showHidden: false, depth: null })

const _getDay = (date) => (day) => new Date(date).getUTCDay() === day
const subtractMe = (date) => (_getDay(date)(1) ? 3 : 1)
const prevWorkDay = (date) => (
  new Date(new Date().setDate(new Date(date).getUTCDate() - subtractMe(date)))
).toISOString().split('T')[0]
const currentDay = _getDay(new Date())
const isWeekend = currentDay(6) || currentDay(0)

const getJournals = async ({ database_id, filters: { date } }) => {
  const { results = [] } = await notion.databases.query({
    database_id,
    filter: { property: 'Date', date: { equals: date } },
  })
  return results.map(({
    id,
    properties: { Assignee, Name },
  }) => ({ id, Name, Assignee }))
}

const filterTasks = ({ tasks, completed }) => tasks.map(({ to_do }) => {
  if (to_do && to_do.checked === completed) {
    return to_do.text[0].plain_text
  }
  return false
}).filter((r) => r)
const getJournalTasks = async ({ block_id }) => {
  const { results = [] } = await notion.blocks.children.list({ block_id })
  return {
    completedTasks: filterTasks({ tasks: results, completed: true }),
    incompleteTasks: filterTasks({ tasks: results, completed: false }),
  }
}

const formatChildren = (tasks) => (tasks.map((t) => ({
  object: 'block',
  type: 'to_do',
  to_do: { text: [{ type: 'text', text: { content: t } }] },
})))

// format completed tasks into single string
//    --> TODO: match format with updates
const formatLWD = (tasks) => {
  if (tasks.length) {
    return `* ${tasks.join('\n* ')}`
  }
  return ''
}

module.exports = {
  showObject,
  prevWorkDay,
  getJournals,
  getJournalTasks,
  formatChildren,
  formatLWD,
  isWeekend,
}
