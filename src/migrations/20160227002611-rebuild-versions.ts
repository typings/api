import db from '../support/knex'

/**
 * Recreate the entire database with new versioning.
 */
export function up () {
  return db('versions').delete()
    .then(() => db('entries').delete())
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_version_compiler_unique')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN compiler DROP NOT NULL')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ADD CONSTRAINT versions_entry_id_version_unique UNIQUE (entry_id, version)')
    })
    .then(() => {
      return db.schema.table('entries', table => {
        table.dropColumn('active')
      })
    })
}

/**
 * Kill the new versioning.
 */
export function down () {
  return db.schema.table('entries', table => {
    table.boolean('active').notNullable().defaultTo(false)
  })
    .then(() => {
      return db('versions')
        .update({ 'compiler': '* '})
        .where('compiler', null)
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN compiler SET NOT NULL')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_version_unique')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN compiler DROP NOT NULL')
    })
    .then(() => {
      return db.raw(
        'ALTER TABLE versions ADD CONSTRAINT ' +
        'versions_entry_id_version_compiler_unique UNIQUE (entry_id, version, compiler)'
      )
    })
}
