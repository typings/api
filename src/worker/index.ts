import Promise = require('native-or-bluebird')
import queue from '../support/kue'
import { exists, createAfter } from './utils/job'

import * as JOBS from '../support/constants/jobs'

import updateDt from './jobs/update-dt'
import updateTypings from './jobs/update-typings'

const processInterval = 1000 * 60 * 60 // Every hour.
const stuckInterval = 1000 * 60 // Every minute.

queue.process(JOBS.UPDATE_DT, 1, createAfter(updateDt, JOBS.UPDATE_DT, {}, processInterval))
queue.process(JOBS.UPDATE_TYPINGS, 1, createAfter(updateTypings, JOBS.UPDATE_TYPINGS, {}, processInterval))

queue.watchStuckJobs(stuckInterval)

Promise.all<boolean, boolean>([exists(JOBS.UPDATE_DT), exists(JOBS.UPDATE_TYPINGS)])
  .then(([dt, typings]) => {
    if (!dt) {
      queue.create(JOBS.UPDATE_DT, {}).save()
    }

    if (!typings) {
      queue.create(JOBS.UPDATE_TYPINGS, {}).save()
    }
  })
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })
