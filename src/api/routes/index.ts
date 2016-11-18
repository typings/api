import express = require('express')

import search from './search'
import versions from './versions'
import entries from './entries'
import status from './status'

const router = express.Router()

router.use('/search', search)
router.use('/versions', versions)
router.use('/entries', entries)
router.use('/status', status)

router.get('/', function (req: express.Request, res: express.Response) {
  res.send(
    'Typings is currently up. Maybe you\'re after documentation? See ' +
    'https://github.com/typings/typings or https://github.com/typings/api ' +
    'for more information.'
  )
})

router.get('/health', function (req: express.Request, res: express.Response) {
  res.status(200).end()
})

export default router
