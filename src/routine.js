const client = require('./client')


const { ASANA_PROJECT = '1152701043959235' } = process.env


const markPastDue = (project = ASANA_PROJECT) => client.projects.tasks(project, {
  completed_since: 'now',
  opt_fields: 'due_on,due_at,completed',
}).then(({ data }) => {
  const marks = data
    .filter((t) => new Date(`${t.due_at ? t.due_at : `${t.due_on}T23:59:59.999Z`}`) < new Date())
    .map(({ gid }) => client.tasks.update(gid, { completed: true }))
  return Promise.all(marks)
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
