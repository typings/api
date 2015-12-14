import kue = require('kue')
import invariant = require('invariant')

const connection = process.env.REDIS_URL

invariant(typeof connection === 'string', 'Environment variable `REDIS_URL` is missing')

export default kue.createQueue({
  redis: connection
})
