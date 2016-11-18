import db from '../support/knex'

/**
 * Create the initial tables.
 */
export function up () {
  return db.schema.createTable('commits', function (table) {
    table.increments('id').primary()
    table.string('commit').notNullable()
    table.string('repo', 2048)
    table.timestamp('date').notNullable()

    table.index(['repo', 'commit']).unique(['repo', 'commit'])
  })
}

/**
 * Drop the initial database tables.
 */
export function down () {
  return db.schema.dropTableIfExists('commits')
}
