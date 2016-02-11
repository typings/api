import Promise = require('any-promise')
import db from '../../../support/knex'

export function upsert (
  table: string,
  data: { [key: string]: string | number | boolean },
  updates: string[],
  where: string[],
  returning?: string
): Promise<string> {
  const insert = db(table)
    .insert(data)
    .toString() +
    ` ON CONFLICT (${where.join(', ')}) DO UPDATE SET ` +
    updates.map(key => `${key}=excluded.${key}`) +
    (returning ? ` RETURNING ${returning}` : '')

  return db.raw(insert).then(function (response) {
    const { rows } = response

    return rows.length ? rows[0][returning] : undefined
  })
}
