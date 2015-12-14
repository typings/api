import Promise = require('native-or-bluebird')
import db from '../../support/knex'

export function insertOrUpdate (
  table: string,
  data: { [key: string]: string | number | boolean },
  updates: string[],
  where: string[],
  returning?: string
): Promise<string> {
  return db(table)
    .insert(data)
    .returning(returning)
    .then(x => x[0])
    .catch(err => {
      // Unique constraint conflict.
      if (err.code === '23505') {
        const updateQuery = db(table)

        for (let field of updates) {
          updateQuery.update(field, data[field])
        }

        for (let field of where) {
          updateQuery.where(field, data[field])
        }

        return updateQuery
          .returning(returning)
          .then(x => x[0])
      }

      return Promise.reject(err)
    })
}
