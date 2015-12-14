import unthenify from '../support/utils/unthenify'
import db from '../support/knex'

export const up = unthenify(function () {
  return db.schema.createTable('entries', function (table) {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.enum('source', ['npm', 'bower', 'ambient', 'github', 'common', 'dt']).notNullable()
    table.string('description', 2048)
    table.string('homepage', 2048)
    table.index(['name', 'source']).unique(['name', 'source'])
  })
    .then(() => {
      return db.schema.createTable('versions', function (table) {
        table.increments('id').primary()
        table.integer('entry_id').references('id').inTable('entries').index().notNullable()
        table.string('version', 64).notNullable()
        table.string('location', 256).notNullable()
        table.string('description', 2048)
        table.string('compiler', 64)
        table.unique(['entry_id', 'version'])
      })
    })
})
