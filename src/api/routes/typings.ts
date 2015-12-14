import express = require('express')
import semver = require('semver')
import db from '../../support/knex'

const router = express.Router()

router.get('/:source/:name', function (req, res, next) {
  return db('versions')
    .select(db.raw('entries.name as entry_name, entries.description as entry_description, entries.homepage as entry_homepage'))
    .select(['versions.version', 'versions.description', 'versions.compiler', 'versions.location'])
    .innerJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', req.params.name)
    .andWhere('entries.source', '=', req.params.source)
    .then(results => {
      if (results.length === 0) {
        return res.status(404).end()
      }

      return res.json({
        name: results[0].entry_name,
        description: results[0].entry_description,
        homepage: results[0].entry_homepage,
        versions: results.map((result: any) => {
          const { version, description, compiler, location } = result

          return { version, description, compiler, location }
        })
      })
    })
    .catch(next as any)
})

router.get('/:source/:name/:version', function (req, res, next) {
  const { params } = req

  return db('versions')
    .select(['versions.version', 'versions.description', 'versions.compiler', 'versions.location'])
    .rightJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', params.name)
    .andWhere('entries.source', '=', params.source)
    .then(results => {
      if (results.length === 0) {
        return res.status(404).end()
      }

      const versions = results
        .sort((a: any, b: any) => {
          if (a.version === '*') {
            return 1
          }

          if (b.version === '*') {
            return -1
          }

          return semver.compare(a.version, b.version)
        })
        .filter((x: any) => x.version === '*' || semver.satisfies(x.version, params.version))

      return res.json({ versions })
    })
    .catch(next as any)
})

export default router
