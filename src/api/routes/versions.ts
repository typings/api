import express = require('express')
import semver = require('semver')
import db from '../../support/knex'

const router = express.Router()

// TODO(blakeembrey): Fix type definition for express routers to accept path array.
router.get('/:source/:name', handler)
router.get('/:source/:name/:version', handler)

/**
 * Express versions query handler.
 */
function handler (req: express.Request, res: express.Response, next: (err: Error) => any) {
  const { params } = req

  return getVersions(params.source, params.name, params.version)
    .then(versions => {
      if (versions.length === 0) {
        return res.status(404).end()
      }

      return res.json({ versions })
    })
    .catch(next)
}

export default router

/**
 * Find matching project versions.
 */
function getVersions (source: string, name: string, version: string = '*') {
  const range = semver.validRange(version)

  if (!range) {
    return Promise.reject(new TypeError(`Invalid Range: ${version}`))
  }

  return db('versions')
    .select(['versions.version', 'versions.description', 'versions.compiler', 'versions.location'])
    .innerJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', name)
    .andWhere('entries.source', '=', source)
    .then(results => {
      // Sort results by semver descending.
      return results
        .filter(x => {
          if (x.version === '*' || range === '*') {
            return true
          }

          return semver.valid(x.version) && semver.satisfies(x.version, range)
        })
        .sort((a: any, b: any) => {
          if (a.version === '*' || !semver.valid(b.version)) {
            return -1
          }

          if (b.version === '*' || !semver.valid(a.version)) {
            return 1
          }

          return semver.rcompare(a.version, b.version)
        })
    })
}
