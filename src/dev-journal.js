const client = require('./client')


const isMonday = new Date().getDay() === 1
const isWeekend = new Date().getDay() === 6 || new Date().getDay() === 0
const subtractMe = isMonday ? 3 : 1
const currentDay = `${new Date().toISOString().split('T')[0]}`
const prevWorkDay = new Date(new Date().setDate(new Date().getDate() - subtractMe))
  .toISOString()
  .split('T')[0]

const _checkDateRange = (start_on, due_on) => (date) => (
  (date >= start_on && date <= due_on) || date === due_on
)

// for those who's on vacay current day --> skip
// for those who's on vacay prev-day but not current day --> grab from day before vacay period
const AVAIL_PROJECT = 1152701043959235
const availCheck = async () => {
  const [{ gid: VACAY_GID }] = await client.sections.getSectionsForProject(AVAIL_PROJECT)
    .then(({ data }) => data.filter(({ name }) => name.toLowerCase().startsWith('vacation')))

  const devAvails = await client.tasks.getTasksForSection(
    VACAY_GID,
    { limit: 50, opt_fields: 'start_on,due_on,name,assignee' },
  ).then(({ data }) => {
    const onVacayPrevDay = []
    const onVacayCurrentDay = []
    data.forEach((task) => {
      const { start_on, due_on } = task
      const isAway = _checkDateRange(start_on, due_on)
      if (isAway(prevWorkDay)) onVacayPrevDay.push(task)
      if (isAway(currentDay)) onVacayCurrentDay.push(task)
    })
    return { onVacayPrevDay, onVacayCurrentDay }
  })

  console.log('test', devAvails)
  return devAvails
}

// get last-work-day journals
const getLWDJournals = async (DEV_JOURNAL) => {
  const prevDayTasks = await client.tasks
    .getTasksForProject(
      DEV_JOURNAL,
      { opt_fields: 'due_on,custom_fields,name,assignee,projects,workspace' },
    )
    .then((r) => r.data.filter(({ due_on }) => due_on === prevWorkDay))
    .catch((e) => console.error(`Failed to fetch prev-work-day tasks: ${e}`))

  const getSubTasks = (task) => client.tasks
    .getSubtasksForTask(task, { opt_fields: 'gid,name,completed,resource_type' })
    .then((r) => r.data)
    .catch((e) => console.error(`Failed to fetch subtasks: ${e}`))

  return Promise.all(prevDayTasks
    .map(async ({ gid, name, assignee, projects, workspace, custom_fields }) => {
      const subTasks = await getSubTasks(gid)
      return {
        gid,
        name,
        assignee,
        projects: projects[0].gid,
        workspace: workspace.gid,
        incompleteSubTasks: subTasks.filter((t) => !t.completed),
        completedSubTasks: subTasks.filter((t) => t.completed),
        customField: custom_fields.find((c) => c.name === 'Last Workday').gid,
      }
    }))
}

// format completed tasks into single string
//    --> TODO: match format with updates
const formatLWD = (tasks) => {
  if (tasks.length) {
    const notes = tasks.map((t) => t.name)
    return `* ${notes.join('\n* ')}`
  }
  return ''
}

// create new journals
module.exports.createJournals = async (DEV_JOURNAL) => {
  await availCheck()
  // if (isWeekend) {
  //   return
  // }
  // try {
  //   const prevJournals = await getLWDJournals(DEV_JOURNAL)
  //   await Promise.all(prevJournals.map(async ({
  //     name,
  //     assignee,
  //     completedSubTasks,
  //     incompleteSubTasks,
  //     projects,
  //     workspace,
  //     customField,
  //   }) => {
  //     const nameTransform = (name) => {
  //       const m = name.match(/(?<person>.*)[(]\d+[)]$/)
  //       if (m) {
  //         const { groups: { person } } = m
  //         return `${person.trim()} (${incompleteSubTasks.length})`
  //       }
  //       return name
  //     }
  //     const params = {
  //       name: nameTransform(name),
  //       assignee,
  //       completed: false,
  //       due_on: `${new Date().toISOString().split('T')[0]}`,
  //       projects: [projects],
  //       workspace,
  //       custom_fields: { [customField]: formatLWD(completedSubTasks) },
  //     }
  //     const { gid } = await client.tasks.createTask(params)
  //     if (!gid) {
  //       return
  //     }

  //     await Promise.all(incompleteSubTasks.map((t) => (
  //       client.tasks.createSubtaskForTask(gid, { name: t.name })
  //     )))
  //   }))
  // } catch (e) {
  //   console.error(`Failed to create new journals: ${e}`)
  // }
}
