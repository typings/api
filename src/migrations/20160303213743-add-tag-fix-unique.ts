import db from '../support/knex'

/**
 * Add a new "tag" field to the database entries.
 */
export function up () {
  return db.raw('DELETE FROM versions WHERE id NOT IN (SELECT MAX(id) FROM versions GROUP BY location)')
    .then(() => {
      return db.schema.table('versions', (table) => {
        table.string('tag', 64)
        table.unique(['entry_id', 'tag'])
      })
    })
    .then(() => {
      return db.raw('UPDATE versions SET tag = version')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ALTER COLUMN tag SET NOT NULL')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_version_unique')
    })
}

/**
 * Kill the new versioning.
 */
export function down () {
  return db.raw('UPDATE versions SET version = tag')
    .then(() => {
      return db.schema.table('versions', (table) => {
        table.dropColumn('tag')
      })
    })
    .then(() => {
      return db.raw('ALTER TABLE versions DROP CONSTRAINT versions_entry_id_location_unique')
    })
    .then(() => {
      return db.raw('ALTER TABLE versions ADD CONSTRAINT versions_entry_id_version_unique UNIQUE (entry_id, version)')
    })
}
