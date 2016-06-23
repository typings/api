import db from '../support/knex'

export function up () {
  return db.raw(
    'DELETE FROM versions v USING entries e WHERE v.entry_id = e.id AND ' +
    'v.updated < e.updated AND v.version = \'*\''
  )
}
