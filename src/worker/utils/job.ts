import kue = require('kue')
import Promise = require('native-or-bluebird')
import thenify = require('thenify')
import queue from '../../support/kue'

/**
 * Check if a job exists in the queue.
 */
export function exists (type: string) {
  return Promise.all<kue.Job[], kue.Job[]>([
    thenify(done => kue.Job.rangeByType(type, 'delayed', 0, 1, 'asc', done))(),
    thenify(done => kue.Job.rangeByType(type, 'active', 0, 1, 'asc', done))()
  ])
    .then(([delayed, active]) => {
      return delayed.length > 0 || active.length > 0
    })
}

/**
 * Create a job after each one finishes.
 */
export function createAfter (fn: (job: kue.Job, cb: (err: any, value?: any) => any) => any, type: string, data: any, delay: number) {
  return function (job: kue.Job, done: (err: any, value: any) => any) {
    return fn(job, function (fnError, result) {
      return queue.create(type, data).delay(delay).save(function (saveError: Error) {
        return done(fnError || saveError, result)
      })
    })
  }
}
