import express = require('express')
import { track } from './support/ua'
import { getLatestCommit } from '../../support/db'
import { REPO_DT_URL, REPO_TYPINGS_URL } from '../../support/constants'

const router = express.Router()

router.get(
  '/',
  track('Status'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    return Promise.all([
      getLatestCommit(REPO_DT_URL),
      getLatestCommit(REPO_TYPINGS_URL)
    ])
      .then(([dt, typings]) => {
        res.json({ dt, typings })
      })
      .catch(next)
  }
)

export default router
