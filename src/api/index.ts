// Import New Relic *first*.
import 'newrelic'

import express = require('express')
import ua = require('universal-analytics')
import routes from './routes'
import env from '../support/env'

declare module 'express/lib/request' {
  interface Request {
    visitor: ua.Visitor
  }
}

const app = express()

if (env.UA_ID) {
  app.use(function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const id = String(req.headers['typings-client-id'])
    req.visitor = ua(env.UA_ID, id)
    res.setHeader('Typings-Client-Id', req.visitor.cid)
    return next()
  })
}

app.use(routes)

if (env.UA_ID) {
  app.use(function (err: Error, req: express.Request, res: express.Response, next: (err: any) => any) {
    // Log middleware errors (mostly "not found" errors).
    req.visitor.exception(err.message).send()

    return next(err)
  })
}

app.listen(env.PORT, () => console.log(`Server listening on port ${env.PORT}...`))
