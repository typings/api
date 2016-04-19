import invariant = require('invariant')

const queueUsername = process.env.QUEUE_UI_USERNAME
const queuePassword = process.env.QUEUE_UI_PASSWORD

invariant(typeof queueUsername === 'string', 'Environment variable `QUEUE_UI_USERNAME` is undefined')
invariant(typeof queuePassword === 'string', 'Environment variable `QUEUE_UI_PASSWORD` is undefined')

invariant(
  process.env.NEW_RELIC_ENABLED === 'false' || typeof process.env.NEW_RELIC_LICENSE_KEY === 'string',
  'New Relic configuration is incomplete (https://github.com/newrelic/node-newrelic#configuring-the-module)'
)

// Import New Relic *first*.
import 'newrelic'

import kue = require('kue')
import express = require('express')
import basicAuth = require('basic-auth-connect')
import ua = require('universal-analytics')
import routes from './routes'

// Create a Kue client before mounting UI.
import '../support/kue'

declare module 'express' {
  interface Request {
    visitor: ua.Visitor
  }
}

const app = express()
const port = process.env.PORT || 3000
const analyticsId = process.env.UA_ID

app.use('/queue', basicAuth(queueUsername, queuePassword), kue.app)

if (analyticsId) {
  app.use(function (req, res, next) {
    const id = req.headers['typings-client-id']
    req.visitor = ua(analyticsId, id)
    res.setHeader('Typings-Client-Id', req.visitor.cid)
    return next()
  })
}

app.use(routes)

if (analyticsId) {
  app.use(function (err: Error, req: express.Request, res: express.Response, next: (err: any) => any) {
    // Log middleware errors (mostly "not found" errors).
    req.visitor.exception(err.message).send()

    return next(err)
  })
}

app.listen(port, () => console.log(`Server listening on port ${port}...`))
