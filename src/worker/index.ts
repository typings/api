import Promise = require('native-or-bluebird')
import queue from '../support/kue'
import { setup } from './utils/job'
import { JOB_UPDATE_DT, JOB_UPDATE_TYPINGS } from '../support/constants'

import updateDt from './jobs/update-dt'
import updateTypings from './jobs/update-typings'

const processInterval = 1000 * 60 * 60 // Every hour.
const stuckInterval = 1000 * 60 // Every minute.

Promise.all([
  setup(updateDt, JOB_UPDATE_DT, {}, processInterval),
  setup(updateTypings, JOB_UPDATE_TYPINGS, {}, processInterval)
])
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

queue.watchStuckJobs(stuckInterval)
