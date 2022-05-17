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

const tasksTransform = async (results) => {
  let completedTasks = []
  let incompleteTasks = []

  for (const task of results) {
    let synced = []

    if (task.to_do) {
      (task.to_do.checked || task.checked)
        ? completedTasks = [...completedTasks, task]
        : incompleteTasks = [...incompleteTasks, task]
    }
    // NOTE: having journal tasks as the original block will not continue to sync in the carried-over tasks
    if (task.synced_block && task.has_children) {
      const syncedTask = await notion.blocks.children.list({ block_id: task.id })
      synced = syncedTask.results
    }
    // NOTE: must grant access to DevJournal integration if syncing tasks from external dbs
    if (task.synced_block?.synced_from) {
      const originalTask = await notion.blocks.retrieve({ block_id: task.synced_block.synced_from.block_id })
      synced = [originalTask]
    }

    if (synced.length) {
      const { completedTasks: ct, incompleteTasks: ict } = await tasksTransform(synced)
      completedTasks = [...completedTasks, ...(ct?.length ? [{ ...task, children: ct }] : [])]
      incompleteTasks = [...incompleteTasks, ...(ict?.length ? [{ ...task, children: ict }] : [])]
    }

    if (task.column_list) {
      const { results } = await notion.blocks.children.list({ block_id: task.id })
      const lists = await Promise.all(results.map(async ({ id: block_id }) => await notion.blocks.children.list({ block_id }) ))
      const incompleteLists = await Promise.all(lists.map(async (list) => {
        const { completedTasks: listCt, incompleteTasks: listIct } = await tasksTransform(list.results)
        completedTasks = [...completedTasks, ...listCt]
        return listIct
      }))
      incompleteTasks = [...incompleteTasks, { ...task, children: incompleteLists }]
    }
  }

  return { completedTasks, incompleteTasks }
}

const getJournalTasks = async ({ block_id }) => {
  const { results = [] } = await notion.blocks.children.list({ block_id })
  return tasksTransform(results)
}

const formatChildren = (tasks) => (tasks.map((t) => {
  if (t.to_do) {
    return ({
      object: 'block',
      type: 'to_do',
      to_do: { rich_text: t.to_do.rich_text.map((t) => {
        if (t.type === 'mention') {
          delete t.mention
          return ({ ...t, type: 'text', text: { content: t.href, link: { url: t.href } } })
        }
        return t
      } ) },
    })
  }
  if (t.synced_block) {
    return ({
      object: 'block',
      type: 'synced_block',
      synced_block: {
        ...t.synced_block,
        children: formatChildren(t.children),
      },
    })
  }
  if (t.column_list) {
    return ({
      object: 'block',
      type: 'column_list',
      column_list: {
        ...t.column_list,
        children: formatChildren(t.children).map((children) => (
          { object: 'block', type: 'column', column: { children } }
        )),
      },
    })
  }
  return t
}))

// format completed tasks into single string
//    --> TODO: match format with updates
const formatLWD = (tasks, s=0) => {
  if (tasks.length) {
    const taskPlainText = tasks.map((task, index) => {
      if (task.to_do) {
        return (task.to_do.rich_text.map((t, i) => {
          let taskDetails = t

          if (t.type === 'mention') {
            delete t.mention
            taskDetails = { ...t, type: 'text', text: { content: t.plain_text, link: { url: t.href } } }
          }

          const link = taskDetails.href ? { url: taskDetails.href } : null
          if (i === 0) {
            const newLine = (index || s) ? '\n' : ''
            return ({
              ...taskDetails,
              plain_text: `${newLine}* ${t.plain_text}`,
              text: { content: `${newLine}* ${t.plain_text}`, link },
            })
          }

          return taskDetails
        }))
      }
      if (task.synced_block && task.children.length) {
        return formatLWD(task.children, s++).flat()
      }
    })
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
