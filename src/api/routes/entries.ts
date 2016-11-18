import express = require('express')
import { track } from './support/ua'
import { getVersions, getMatchingVersions, getLatest, getTag, getEntry } from './support/db'

const router = express.Router()

router.get(
  '/:source/:name',
  track('Entry'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getEntry(params['source'], params['name'])
      .then(entry => res.json(entry))
      .catch(next)
  }
)

router.get(
  '/:source/:name/versions',
  track('Entry Versions'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params, query } = req

    return getVersions(params['source'], params['name'], !!query['deprecated'])
      .then(versions => res.json(versions))
      .catch(next)
  }
)

router.get(
  '/:source/:name/versions/latest',
  track('Latest Entry Version'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getLatest(params['source'], params['name'])
      .then(version => res.json(version))
      .catch(next)
  }
)

router.get(
  '/:source/:name/versions/:version',
  track('Entry Version Range'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getMatchingVersions(params['source'], params['name'], params['version'])
      .then(versions => res.json(versions))
      .catch(next)
  }
)

router.get(
  '/:source/:name/versions/:version/latest',
  track('Latest Entry Version Range'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getLatest(params['source'], params['name'], params['version'])
      .then(version => res.json(version))
      .catch(next)
  }
)

router.get(
  '/:source/:name/tags/:tag',
  track('Entry Tag'),
  function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const { params } = req

    return getTag(params['source'], params['name'], params['tag'])
      .then(tag => res.json(tag))
      .catch(next)
  }
)

export default router
