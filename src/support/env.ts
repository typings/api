import envobj = require('envobj')

export interface Env {
  PORT: number
  UA_ID: string
  DATABASE_URL: string
}

export default envobj<Env>({
  PORT: 3000,
  UA_ID: '',
  DATABASE_URL: String
})
