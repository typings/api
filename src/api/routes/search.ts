import express = require('express')
import Promise = require('native-or-bluebird')
import arrify = require('arrify')
import db from '../../support/knex'
import { AMBIENT_SOURCES, MAIN_SOURCES, ALL_SOURCES } from '../../support/constants'

const router = express.Router()

router.get('/', function (req, res, next) {
  const { query } = req
  const offset = Math.max(+query.offset || 0, 0)
  const limit = Math.max(Math.min(+query.limit || 20, 50), 1)

  const dbQuery = db('entries')

  if (query.query) {
    dbQuery.whereRaw('tsv @@ plainto_tsquery(?)', [query.query])
  }

  if (query.name) {
    dbQuery.andWhere('name', query.name)
  }

  let sources = ALL_SOURCES

  // Override the sources search using `source=` or `ambient=`.
  if (query.source != null) {
    sources = arrify(query.source)
  } else if (query.ambient != null) {
    sources = query.ambient === 'true' ? AMBIENT_SOURCES : MAIN_SOURCES
  }

  dbQuery.where(function () {
    for (const source of sources) {
      this.orWhere('source', source)
    }
  })

  const totalQuery = dbQuery.clone().count('id')

  const searchQuery = dbQuery.clone()
    .select(['name', 'source', 'homepage', 'description'])
    .offset(offset)
    .limit(limit)
    .debug()

  if (query.query) {
    searchQuery.orderByRaw('ts_rank(tsv, plainto_tsquery(?)) DESC', [query.query])
  }

  searchQuery.orderBy('name', 'asc')

  interface Result {
    name: string
    source: string
    homepage: string
    description: string
    rank: number
  }

  return Promise.all<Result[], [{ count: string }]>([searchQuery, totalQuery])
    .then(([results, totals]) => {
      return res.json({
        results: results.map(({ name, source, homepage, description }) => {
          return { name, source, homepage, description }
        }),
        total: Number(totals[0].count)
      })
    })
    .catch(next as any)
})

export default router
