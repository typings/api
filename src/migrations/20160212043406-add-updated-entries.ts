import db from '../support/knex'

/**
 * Update the unique constraint, add updated field to versions.
 */
export function up () {
  return db.schema.table('entries', table => {
    table.timestamp('updated')
  })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN updated DROP NOT NULL')
    })
}

/**
 * Restore unique constraint, remove date fields.
 */
export function down () {
  return db.schema.table('entries', table => {
    table.dropColumn('updated')
  })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN updated SET NOT NULL')
    })
}
