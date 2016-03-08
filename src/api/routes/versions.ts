import express = require('express')
import { getVersions } from './support/db'
import { track } from './support/ua'

const router = express.Router()

router.get('/:source/:name/:version?', track('Version'), function (req: express.Request, res: express.Response, next: (err: Error) => any) {
  const { params } = req

  return getVersions(params.source, params.name, params.version)
    .then(versions => {
      return res.json({ versions })
    })
    .catch(next)
})

export default router
