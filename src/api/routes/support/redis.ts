import redis = require('redis')
import Promise = require('any-promise')

const client = redis.createClient()

export function getVersion (source: string, name: string): Promise<any> {
  const key = `${source}:${name}`

  return new Promise((resolve: Function, reject: Function) => {
    client.get(key, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
