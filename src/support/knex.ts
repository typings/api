import knex = require('knex')
import invariant = require('invariant')

const connection = process.env.DATABASE_URL

invariant(typeof connection === 'string', 'Environment variable `DATABASE_URL` is missing')

export default knex({
  client: 'pg',
  connection
})
