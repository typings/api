import express = require('express')

import search from './search'
import typings from './typings'

const router = express.Router()

router.use('/search', search)
router.use('/typings', typings)

export default router
