import _ = require('lodash')
import redis = require('redis')
import Promise = require('any-promise')

const client = redis.createClient()

export function setVersion (options: any) {
  const option = _.clone(options.insert)
  delete option.entry_id

  client.set(options.redisKey, JSON.stringify(option))
}

export function deleteVersion (source: string, name: string) {
  return new Promise((resolve) => {
    client.del(`${source}:${name}`, () => resolve())
  })
}
