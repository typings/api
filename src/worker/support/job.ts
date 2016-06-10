import kue = require('kue')
import Promise = require('any-promise')
import thenify = require('thenify')
import unthenify = require('unthenify')
import queue from '../../support/kue'

/**
 * Check if a job exists in the queue.
 */
export function jobExists (type: string) {
  return Promise.all<Array<kue.Job<any>>, Array<kue.Job<any>>>([
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
export function createJobAfter (fn: (job: kue.Job<any>) => Promise<any>, type: string, delay: number) {
  return function (job: kue.Job<any>) {
    return fn(job)
      .then(function (data) {
        const job = queue.create(type, data)
        job.delay(delay)
        job.removeOnComplete(true)
        return thenify(cb => job.save(cb))()
      })
  }
}

/**
 * Set up a function that starts or repeats itself.
 */
export function setupRepeatJob (fn: (job: kue.Job<any>) => Promise<any>, type: string, data: any, delay: number) {
  const handle = unthenify(createJobAfter(fn, type, delay))

  queue.process(type, 1, handle)

  return jobExists(type)
    .then(exists => {
      if (!exists) {
        const job = queue.create(type, data)
        job.removeOnComplete(true)
        job.save()
      }
    })
}
