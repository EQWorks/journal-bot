const notion = require('./notion-client')
const { databases } = require('./config')
const {
  prevWorkDay,
  getJournals,
  formatChildren,
  formatLWD,
  nameTransform,
  filterIdle,
  isWeekend,
} = require('./util')


const today = `${new Date().toISOString().split('T')[0]}`
module.exports.journalRoutine = async () => {
  if (isWeekend) {
    return
  }
  try {
    await Promise.all(databases.map(async ({ id: database_id }) => {
      const prevDayJournals = await getJournals({
        database_id,
        filters: { date: prevWorkDay(today) },
      })
      const activeJournals = await filterIdle(prevDayJournals)
      await Promise.all(
        activeJournals.map(async ({ Idle, Name, Assignee, completedTasks, incompleteTasks }) => {
          await notion.pages.create({
            parent: { database_id },
            properties: {
              Name: nameTransform({ Name, incompleteTasks }),
              Assignee,
              Date: { type: 'date', date: { start: today } },
              'Last Workday': {
                type: 'rich_text',
                rich_text: [{ type: 'text', text: { content: formatLWD(completedTasks) } }],
              },
              Idle,
            },
            children: formatChildren(incompleteTasks),
          })
        }),
      )
    }))
  } catch (e) {
    console.error(`Failed to run Notion Dev Journal routine: ${e}`)
  }
}
