import Promise = require('native-or-bluebird')
import queue from '../support/kue'
import { setup } from './utils/job'

import * as JOBS from '../support/constants/jobs'

import updateDt from './jobs/update-dt'
import updateTypings from './jobs/update-typings'

const processInterval = 1000 * 60 * 60 // Every hour.
const stuckInterval = 1000 * 60 // Every minute.

Promise.all([
  setup(updateDt, JOBS.UPDATE_DT, {}, processInterval),
  setup(updateTypings, JOBS.UPDATE_TYPINGS, {}, processInterval)
])
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

queue.watchStuckJobs(stuckInterval)
