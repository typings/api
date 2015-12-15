import express = require('express')

import search from './search'
import versions from './versions'

const router = express.Router()

router.use('/search', search)
router.use('/versions', versions)

export default router
