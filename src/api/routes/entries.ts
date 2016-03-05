import express = require('express')
import { getVersions, getTag, getEntry } from './support/db'

const router = express.Router()

router.get('/:source/:name', function (req, res, next) {
  const { params } = req

  return getEntry(params.source, params.name)
    .then(entry => res.json(entry))
    .catch(next as any)
})

router.get('/:source/:name/versions/:version?', function (req, res, next) {
  const { params } = req

  return getVersions(params.source, params.name, params.version)
    .then(versions => {
      return res.json({ versions, total: versions.length })
    })
})

router.get('/:source/:name/tags/:tag', function (req, res, next) {
  const { params } = req

  return getTag(params.source, params.name, params.tag)
    .then(tag => res.json(tag))
    .catch(next as any)
})

export default router
