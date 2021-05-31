const notion = require('./notion-client')
const { prevWorkDay, getJournals, getJournalTasks, formatChildren, formatLWD } = require('./util')


const { DATABASE_ID } = process.env

const today = `${new Date().toISOString().split('T')[0]}`
const journalRoutine = async () => {
  try {
    const prevDayJournals = await getJournals({
      database_id: DATABASE_ID,
      filters: { date: prevWorkDay(today) },
    })
    prevDayJournals.map(async ({ id, Name, Assignee }) => {
      const { completedTasks, incompleteTasks } = await getJournalTasks({ block_id: id })
      await notion.pages.create({
        parent: { database_id: DATABASE_ID },
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
    })
  } catch (e) {
    console.error(e)
  }
}

journalRoutine()
