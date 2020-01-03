const client = require('./client')


const { ASANA_PROJECT = '1152701043959235' } = process.env

const pastFilter = (task) => new Date(`${task.due_at ? task.due_at : `${task.due_on}T23:59:59}`}`)
  < new Date()

const markPastDue = (project_id = ASANA_PROJECT) => client.projects.tasks(project_id, {
  completed_since: 'now',
  opt_fields: 'due_on,due_at,name,notes,completed',
}).then(({ data }) => {
  const past = data.filter(pastFilter)
  return Promise.all(past.map(({ gid }) => client.tasks.update(gid, { completed: true })))
})

if (typeof require !== 'undefined' && require.main === module) {
  markPastDue().then((res) => {
    /* eslint-disable */
    console.log(res)
    console.log(`Daily sweeping done! ${res.length} past time slots marked as complete!`)
    /* eslint-enable */
    process.exit(0)
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
