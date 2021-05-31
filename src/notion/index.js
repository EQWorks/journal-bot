const notion = require('./notion-client')
const { databases } = require('./config')
const {
  prevWorkDay,
  getJournals,
  getJournalTasks,
  formatChildren,
  formatLWD,
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
      await Promise.all(prevDayJournals.map(async ({ id, Name, Assignee }) => {
        const { completedTasks, incompleteTasks } = await getJournalTasks({ block_id: id })
        await notion.pages.create({
          parent: { database_id },
          properties: {
            Name,
            Assignee,
            Date: { type: 'date', date: { start: today } },
            'Last Workday': {
              type: 'rich_text',
              rich_text: [{ type: 'text', text: { content: formatLWD(completedTasks) } }],
            },
          },
          children: formatChildren(incompleteTasks),
        })
      }))
    }))
  } catch (e) {
    console.error(`Failed to run Notion Dev Journal routine: ${e}`)
  }
}
