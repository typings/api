import express = require('express')
import { getVersions, getMatchingVersions } from './support/db'
import { track } from './support/ua'

const router = express.Router()

router.get(
  '/:source/:name',
  track('Versions'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getVersions(params['source'], params['name'], false)
      .then(versions => res.json({ versions }))
      .catch(next)
  }
)

router.get(
  '/:source/:name/:version',
  track('Version Range'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getMatchingVersions(params['source'], params['name'], params['version'])
      .then(versions => res.json({ versions }))
      .catch(next)
  }
)

export default router
