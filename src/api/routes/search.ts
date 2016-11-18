import express = require('express')
import { search } from './support/db'
import { track } from './support/ua'

const router = express.Router()

router.get('/', track('Search'), function (req: express.Request, res: express.Response, next: express.NextFunction) {
  const { query } = req

  return search(query)
    .then(result => res.json(result))
    .catch(next)
})

export default router
