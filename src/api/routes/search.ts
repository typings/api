import express = require('express')
import Promise = require('native-or-bluebird')
import db from '../../support/knex'

const router = express.Router()

router.get('/', function (req, res, next) {
  const { query } = req

  const dbQuery = db('entries')

  if (typeof query.query === 'string') {
    dbQuery.orWhere('name', 'LIKE', `%${query.query}%`)
    dbQuery.orWhere('homepage', 'LIKE', `%${query.query}%`)
    dbQuery.orWhere('description', 'LIKE', `%${query.query}%`)
  }

  if (typeof query.name === 'string') {
    dbQuery.andWhere('name', query.name)
  }

  if (typeof query.source === 'string') {
    dbQuery.andWhere('source', query.source)
  }

  const totalQuery = dbQuery.clone().count('id')

  const searchQuery = dbQuery.clone()
    .select(['name', 'source', 'homepage', 'description'])
    .offset(+query.offset || 0)
    .limit(Math.min(+query.limit || 20, 50))
    .orderBy('name', 'asc')

  return Promise.all<any[], [{ count: string }]>([searchQuery, totalQuery])
    .then(([results, totals]) => {
      return res.json({ results, total: totals[0].count })
    })
    .catch(next as any)
})

export default router
