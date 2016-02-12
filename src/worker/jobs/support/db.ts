import knex = require('knex')
import Promise = require('any-promise')
import db from '../../../support/knex'

export interface UpsertOptions {
  table: string
  insert: { [key: string]: string | number | boolean }
  updates: string[]
  conflicts: string[]
  trx?: knex.Transaction
  where?: string
  returning?: string
}

export function upsert (options: UpsertOptions): Promise<string> {
  const insert = db(options.table)
    .insert(options.insert)
    .transacting(options.trx)
    .toString() +
    ` ON CONFLICT (${options.conflicts.join(', ')}) DO UPDATE SET ` +
    options.updates.map(key => `${key}=excluded.${key}`) +
    (options.where ? ` WHERE ${options.where}` : '') +
    (options.returning ? ` RETURNING ${options.returning}` : '')

  return db.raw(insert).then(function (response) {
    const { rows } = response

    return rows.length ? rows[0][options.returning] : undefined
  })
}
