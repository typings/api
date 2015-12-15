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
    .then(versions => res.json({ versions }))
    .catch(next)
}

export default router

/**
 * Find matching project versions.
 */
function getVersions (source: string, name: string, version?: string) {
  return db('versions')
    .select(['versions.version', 'versions.description', 'versions.compiler', 'versions.location'])
    .innerJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', name)
    .andWhere('entries.source', '=', source)
    .then(results => {
      if (version == null) {
        return results
      }

      // Sort results by semver.
      return results
        .sort((a: any, b: any) => {
          if (a.version === '*') {
            return -1
          }

          if (b.version === '*') {
            return 1
          }

          return semver.rcompare(a.version, b.version)
        })
        .filter((x: any) => x.version === '*' || semver.satisfies(x.version, version))
    })
}
