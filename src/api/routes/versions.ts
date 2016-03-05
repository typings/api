import express = require('express')
import { getVersions } from './support/db'

const router = express.Router()

// TODO(blakeembrey): Fix type definition for express routers to accept path array.
router.get('/:source/:name', handler)
router.get('/:source/:name/:version', handler)

export default router

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
