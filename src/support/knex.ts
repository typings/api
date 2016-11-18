import knex = require('knex')
import env from './env'

export default knex({
  client: 'pg',
  connection: env.DATABASE_URL
})
