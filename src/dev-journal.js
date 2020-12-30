const client = require('./client')


const DEV_JOURNAL = '1153484903445659'
const isMonday = new Date().getDay() === 1
const subtractMe = isMonday ? 3 : 1
const prevWorkDay = new Date(new Date().setDate(new Date().getDate() - subtractMe))
  .toISOString()
  .split('T')[0]
const params = {
  project: DEV_JOURNAL,
  opt_fields: 'completed,projects.name,due_on,name,notes,subtasks,assignee.name,custom_fields',
}

/* NO TASK-NESTING FOR NOW */
// get subTasks and children of subTasks
// const getSubTasks = async (task, completed) => {
//   const tasks = completed
//      ? await getFilteredTasks(task, true)
//      : await getFilteredTasks(task, false)
//   if (tasks.length > 0) {
//     const taskParam = tasks.map(async (t) => {
//       const subChildTasks = completed
//         ? await getFilteredTasks(t, true)
//         : await getFilteredTasks(t, false)
//       if (subChildTasks.length > 0) {
//         const subChildParams = subChildTasks.map(async (child) => ({
//           name: child.name,
//           subTasks: await getSubTasks(child, completed),
//         }))
//         const childTasks = await Promise.all(subChildParams).then((r) => r)
//         return { name: t.name, subTasks: childTasks }
//       }
//       return { name: t.name, subTasks: [] }
//     })
//     return Promise.all(taskParam).then((r) => r)
//   }
//   return []
// }

const _getJournals = () => async () => {
  const _prevDayTasks = await client.tasks
    .getTasksForProject(
      DEV_JOURNAL,
      { opt_fields: 'due_on,custom_fields,name,assignee,projects,workspace' },
    )
    .then((r) => r.data.filter(({ due_on }) => due_on === prevWorkDay))
    .catch((e) => console.error(`Failed to fetch prev-work-day tasks: ${e}`))

  const _getSubTasks = (task) => client.tasks
    .getSubtasksForTask(task, { opt_fields: 'gid,name,completed,resource_type' })
    .then((r) => r.data)
    .catch((e) => console.error(`Failed to fetch subtasks: ${e}`))

  const _taskArr = _prevDayTasks
    .map(async ({ gid, name, assignee, projects, workspace, custom_fields }) => {
      const subTasks = await _getSubTasks(gid)
      return {
        gid,
        name,
        assignee,
        projects: projects[0].gid,
        workspace: workspace.gid,
        incompleteSubTasks: subTasks.filter((t) => !t.completed),
        completedSubTasks: subTasks.filter((t) => t.completed),
        customField: custom_fields.find((c) => c.name === 'Last Workday'),
      }
    })
  return Promise.all(_taskArr)
}

const _getFieldInfo = (params) => async (field) => {
  const { data } = await client.tasks.findAll(params)
  const prevDayTasks = data.filter((task) => (task.due_on && task.due_on === prevWorkDay))
  let result
  if (field === 'lwd') {
    result = prevDayTasks.map((d) => {
      const lastWorkday = d.custom_fields[0].text_value
      if (lastWorkday) return { name: d.name, lastWorkday }
      return undefined
    })
  }
  if (field === 'des') {
    result = prevDayTasks.map((d) => {
      if (d.notes) return { name: d.name, description: d.notes }
      return undefined
    })
  }
  return result.filter((r) => r !== undefined)
}

module.exports.getJournals = _getJournals(params)
module.exports.getFieldInfo = _getFieldInfo(params)
