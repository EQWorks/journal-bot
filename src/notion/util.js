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
  return results.map(({ id, properties: { Assignee, Name, Idle } }) => {
    if (!Assignee.people.length) return null
    return ({ id, Name, Assignee, Idle })
  }).filter((r) => r)
}

const filterTasks = ({ tasks, completed }) => tasks.map(({ to_do }) => {
  if (to_do && to_do.checked === completed) {
    return to_do.text
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
  to_do: { text: t.map((t) => {
    if (t.type === 'mention') {
      delete t.mention
      return ({ ...t, type: 'text', text: { content: t.href, link: { url: t.href } } })
    }
    return t
  } ) },
})))

// format completed tasks into single string
//    --> TODO: match format with updates
const formatLWD = (tasks) => {
  if (tasks.length) {
    const taskPlainText = tasks.map((task) => (task.map((t, i) => {
      let taskDetails = t
      if (t.type === 'mention') {
        delete t.mention
        taskDetails = { ...t, type: 'text', text: { content: t.plain_text, link: { url: t.href } } }
      }

      const link = taskDetails.href ? { url: taskDetails.href } : null
      if (i === 0) {
        const newLine = task.length === 1 ? '\n' : ''
        return ({
          ...taskDetails,
          plain_text: `* ${t.plain_text}${newLine}`,
          text: { content: `* ${t.plain_text}${newLine}`, link },
        })
      }
      if (i === (task.length - 1)) {
        return ({
          ...taskDetails,
          plain_text: `${t.plain_text}\n`,
          text: { content: `${t.plain_text}\n`, link },
        })
      }
      return taskDetails
    })))
    return taskPlainText
  }
  return []
}

const nameTransform = ({ Name, incompleteTasks, Assignee }) => {
  let _Name = Name
  if (Assignee.people.length && !(Name.title.length)) {
    _Name = { ...Name, title: [{ text: {}, plain_text: (Assignee.people[0].name).split(' ')[0] }] }
  }

  const { title: [{ plain_text: name }] } = _Name
  let plain_text = name

  const m = name.match(/(?<person>.*)[(]\d+[)]$/)
  if (m) {
    const { groups: { person } } = m
    plain_text = `${person.trim()} (${incompleteTasks.length})`
  }

  return ({
    ..._Name,
    title: [{
      ..._Name.title[0],
      text: { ..._Name.title[0].text, content: plain_text },
      plain_text,
    }],
  })
}

const filterIdle = async (prevDayJournals) => {
  const activeJournals = await Promise.all(prevDayJournals
    .map(async ({ id, Idle, Name, Assignee }) => {
      if (!(Assignee.people.length) && !(Name.title.length)) return null

      const { completedTasks, incompleteTasks } = await getJournalTasks({ block_id: id })
      let idle = Idle

      if (Idle && completedTasks.length) {
        idle = undefined
      }
      if (!completedTasks.length) {
        if (Idle) {
          const { number } = Idle
          if (number >= 5) return null
          idle = { ...Idle, number: Idle.number + 1 }
        } else {
          idle = { type: 'number', number: 1 }
        }
      }

      return { id, Idle: idle, Name, Assignee, completedTasks, incompleteTasks }
    }))
  return activeJournals.filter((r) => r)
}

module.exports = {
  showObject,
  prevWorkDay,
  getJournals,
  getJournalTasks,
  formatChildren,
  formatLWD,
  nameTransform,
  filterIdle,
  isWeekend,
}
