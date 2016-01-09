import kue = require('kue')
import thenify = require('thenify')
import Promise = require('native-or-bluebird')

import '../support/kue'

/**
 * Remove old Kue jobs.
 */
export function up (): Promise<void> {
  return thenify(done => kue.Job.rangeByState('complete', 0, 50, 'asc', done))()
    .then((jobs: kue.Job[]) => {
      const removeJobs = jobs.map(job => {
        return thenify(done => job.remove(done))()
      })

      return Promise.all(removeJobs)
    })
    .then((removed: any[]) => {
      if (removed.length === 0) {
        return
      }

      return up()
    })
}
