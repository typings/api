import db from '../support/knex'

/**
 * Add a new "tag" field to the database entries.
 */
export function up () {
  return db.schema.table('versions', table => {
    table.timestamp('deprecated')
  })
}

/**
 * Kill the new versioning.
 */
export function down () {
  return db.schema.table('versions', table => {
    table.dropColumn('deprecated')
  })
}
