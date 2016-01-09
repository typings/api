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
      const job = queue.create(type, data)
      job.delay(delay)
      job.removeOnComplete(true)
      job.save((saveError: Error) => done(fnError || saveError, result))
    })
  }
}

/**
 * Set up a function that starts or repeats itself.
 */
export function setup (fn: (job: kue.Job, cb: (err: any, value?: any) => any) => any, type: string, data: any, delay: number) {
  queue.process(type, 1, createAfter(fn, type, data, delay))

  return exists(type)
    .then(exists => {
      if (!exists) {
        const job = queue.create(type, data)
        job.removeOnComplete(true)
        job.save()
      }
    })
}
