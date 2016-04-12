import Promise = require('any-promise')
import ms = require('ms')
import unthenify = require('unthenify')
import queue from '../support/kue'
import { setupRepeatJob } from './support/job'
import {
  JOB_UPDATE_DT,
  JOB_UPDATE_TYPINGS,
  JOB_INDEX_DT_COMMIT,
  JOB_INDEX_TYPINGS_COMMIT,
  JOB_INDEX_DT_FILE_CHANGE,
  JOB_INDEX_TYPINGS_FILE_CHANGE
} from '../support/constants'

import { updateDt, indexDtCommit, indexDtFileChange } from './jobs/dt'
import { updateTypings, indexTypingsCommit, indexTypingsFileChange } from './jobs/typings'

const stuckInterval = ms('2m')
const processInterval = ms('5m')

Promise.all([
  setupRepeatJob(updateDt, JOB_UPDATE_DT, {}, processInterval),
  setupRepeatJob(updateTypings, JOB_UPDATE_TYPINGS, {}, processInterval)
])
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

// Restart jobs that have stalled.
queue.watchStuckJobs(stuckInterval)

// Parse commits and files and queue changes. One at a time for sequential processing.
queue.process(JOB_INDEX_DT_COMMIT, 1, unthenify(indexDtCommit))
queue.process(JOB_INDEX_TYPINGS_COMMIT, 1, unthenify(indexTypingsCommit))
queue.process(JOB_INDEX_DT_FILE_CHANGE, 1, unthenify(indexDtFileChange))
queue.process(JOB_INDEX_TYPINGS_FILE_CHANGE, 1, unthenify(indexTypingsFileChange))

process.once('SIGTERM', function () {
  // TODO: Fix Kue definition to omit `type` argument.
  queue.shutdown(5000, '', function (err: Error) {
    console.log('Kue shutdown', err || '')
    process.exit(0)
  })
})
