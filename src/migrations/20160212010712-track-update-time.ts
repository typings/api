import db from '../support/knex'

/**
 * Update the unique constraint, add updated field to versions.
 */
export function up () {
  return db('versions')
    .update({ compiler: '*' })
    .whereNull('compiler')
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_version_unique')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN compiler SET NOT NULL')
    })
    .then(() => {
      return db.schema.table('versions', table => {
        table.timestamp('updated').notNullable().defaultTo(new Date(0).toISOString())
        table.unique(['entry_id', 'version', 'compiler'])
      })
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN updated DROP DEFAULT')
    })
    .then(() => {
      return db.schema.table('entries', table => {
        table.boolean('active').notNullable().defaultTo(false)
      })
    })
}

/**
 * Restore unique constraint, remove date fields.
 */
export function down () {
  return db.schema.table('versions', table => {
    table.dropColumn('updated')
  })
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_version_compiler_unique')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ADD CONSTRAINT versions_entry_id_version_unique UNIQUE (entry_id, version)')
    })
}
