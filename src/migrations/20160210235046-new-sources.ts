import db from '../support/knex'

/**
 * Drop constraint on source location.
 */
export function up () {
  return db.raw('ALTER TABLE entries DROP CONSTRAINT entries_source_check')
    .then(() => db.raw(`DELETE FROM versions WHERE entry_id IN (SELECT id FROM entries WHERE source = 'ambient')`))
    .then(() => db.raw(`DELETE FROM entries WHERE source = 'ambient'`))
}

/**
 * Add constraint back to entries.
 */
export function down () {
  return db
    .del()
    .whereNotIn('source', ['npm', 'bower', 'ambient', 'github', 'common', 'dt'])
    .then(() => {
      return db.raw(
        'ALTER TABLE entries ADD CONSTRAINT "entries_source_check" ' +
        'CHECK (source = ANY (ARRAY[\'npm\'::text, \'bower\'::text, \'ambient\'::text, ' +
        '\'github\'::text, \'common\'::text, \'dt\'::text]))'
      )
    })
}
