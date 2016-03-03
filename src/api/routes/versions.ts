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
    return Promise.reject(new TypeError(`Invalid Semver Range: ${version}`))
  }

  interface Result {
    tag: string
    version: string
    description: string
    compiler: string
    location: string
    updated: Date
  }

  return db('versions')
    .select(['versions.tag', 'versions.version', 'versions.description', 'versions.compiler', 'versions.location', 'versions.updated'])
    .innerJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', name)
    .andWhere('entries.source', '=', source)
    .orderBy('updated', 'desc')
    .then((results: Result[]) => {
      return results
        .filter((x) => semver.satisfies(x.tag, range))
        .sort((a, b) => {
          const result = semver.rcompare(a.tag, b.tag)

          if (result === 0) {
            return b.updated.getTime() - a.updated.getTime()
          }

          return result
        })
    })
}
