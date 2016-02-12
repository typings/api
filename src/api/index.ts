import kue = require('kue')
import express = require('express')
import basicAuth = require('basic-auth-connect')
import invariant = require('invariant')
import routes from './routes'

const queueUsername = process.env.QUEUE_UI_USERNAME
const queuePassword = process.env.QUEUE_UI_PASSWORD

invariant(typeof queueUsername === 'string', 'Environment variable `QUEUE_UI_USERNAME` is undefined')
invariant(typeof queuePassword === 'string', 'Environment variable `QUEUE_UI_PASSWORD` is undefined')

invariant(
  process.env.NEW_RELIC_ENABLED === 'false' || typeof process.env.NEW_RELIC_LICENSE_KEY === 'string',
  'New Relic configuration is incomplete (https://github.com/newrelic/node-newrelic#configuring-the-module)'
)

// Import New Relic setup.
import 'newrelic'

// Must create the Kue client before mounting the GUI.
import '../support/kue'

const app = express()
const port = process.env.PORT || 3000

app.use('/queue', basicAuth(queueUsername, queuePassword), kue.app)

app.use(routes)

app.listen(port, () => console.log(`Server listening on port ${port}...`))
