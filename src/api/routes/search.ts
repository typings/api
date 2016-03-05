import express = require('express')
import { search } from './support/db'

const router = express.Router()

router.get('/', function (req, res, next) {
  const { query } = req

  return search(query)
    .then(result => res.json(result))
    .catch(next as any)
})

export default router
