import express = require('express')

import search from './search'
import versions from './versions'
import entries from './entries'

const router = express.Router()

router.use('/search', search)
router.use('/versions', versions)
router.use('/entries', entries)

router.get('/', function (req, res) {
  res.send(
    'Typings is currently up. Maybe you\'re after documentation? See ' +
    'https://github.com/typings/typings or https://github.com/typings/api ' +
    'for more information'
  )
})

router.get('/health', function (req, res) {
  res.status(200).end()
})

export default router
