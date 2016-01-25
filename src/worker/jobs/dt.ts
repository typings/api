import kue = require('kue')
import { basename } from 'path'
import thenify = require('thenify')
import Promise = require('native-or-bluebird')
import { Minimatch } from 'minimatch'
import queue from '../../support/kue'
import db from '../../support/knex'

import { updateOrClone, commitsSince, commitFilesChanged, getFile } from './support/git'
import { upsert } from './support/db'

import {
  JOB_INDEX_DT_COMMIT,
  REPO_DT_PATH,
  REPO_DT_URL,
  TIMEOUT_REPO_POLL,
  JOB_INDEX_DT_FILE_CHANGE
} from '../../support/constants'

const VERSION_REGEXP_STRING = '\\d+\\.(?:\\d+|x)(?:\\.(?:\\d+|x)(?:\\-[^\\-\\s]+)?)?'

const DT_CONTENT_VERSION_REGEXP = new RegExp(`Type definitions for .* v?(${VERSION_REGEXP_STRING})$`, 'im')
const DT_CONTENT_PROJECT_REGEXP = /^\/\/ *Project: *([^\s]+)/im
const DT_FILE_VERSION_REGEXP = new RegExp(`-${VERSION_REGEXP_STRING}$`)

const definitionPaths = new Minimatch('*/*.d.ts')

/**
 * Job queue processing DefinitelyTyped repo data.
 */
export function updateDt (job: kue.Job) {
  return updateOrClone(REPO_DT_PATH, REPO_DT_URL, TIMEOUT_REPO_POLL)
    .then(() => processCommits(job))
}

/**
 * Process commits since last job.
 */
function processCommits (job: kue.Job) {
  return new Promise((resolve, reject) => {
    let { commit } = job.data
    const stream = commitsSince(REPO_DT_PATH, commit)

    stream.on('data', function (currentCommit: string) {
      commit = currentCommit

      const job = queue.create(JOB_INDEX_DT_COMMIT, { commit })
      job.removeOnComplete(true)
      job.save()
    })

    stream.on('error', reject)
    stream.on('end', () => resolve({ commit }))
  })
}

/**
 * Index DT commit changes.
 */
export function indexDtCommit (job: kue.Job) {
  const { commit } = job.data

  return commitFilesChanged(REPO_DT_PATH, commit)
    .then(files => {
      return Promise.all(files.map(change => {
        if (!definitionPaths.match(change[1])) {
          return
        }

        return thenify(cb => {
          const job = queue.createJob(JOB_INDEX_DT_FILE_CHANGE, { change, commit })
          job.removeOnComplete(true)
          job.save(cb)
        })()
      }))
    })
}

export function indexDtFileChange (job: kue.Job): Promise<any> {
  const source = 'dt'
  const { change, commit } = job.data
  const [type, path] = change

  // Ignore DT deletions.
  if (type === 'D') {
    return db.transaction(trx => {
      return db('versions')
        .transacting(trx)
        .where('location', 'LIKE', getLocation(path, '%'))
        .del()
        .returning('entry_id')
        .then(rows => {
          return Promise.all(rows.map((entryId: string) => {
            return db('entries')
              .transacting(trx)
              .del()
              .where('id', entryId)
              .whereNotExists(function () {
                this.select().from('versions').where('entry_id', entryId)
              })
          }))
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
  }

  const filename = basename(path, '.d.ts')
  const name = filename.replace(DT_FILE_VERSION_REGEXP, '')
  let version: string
  let homepage: string

  if (name !== filename) {
    version = normalizeVersion(filename.substr(name.length + 1))
  }

  return getFile(REPO_DT_PATH, path, commit, 1024)
    .then(contents => {
      const contentVersion = DT_CONTENT_VERSION_REGEXP.exec(contents)
      const contentHomepage = DT_CONTENT_PROJECT_REGEXP.exec(contents)

      // Update the known version.
      if (contentVersion) {
        version = normalizeVersion(contentVersion[1])
      }

      if (contentHomepage) {
        homepage = contentHomepage[1]
      }

      return upsert(
        'entries',
        { name, source, homepage },
        ['homepage'],
        ['name', 'source'],
        'id'
      )
        .then((id: string) => {
          return upsert(
            'versions',
            {
              entry_id: id,
              version: version || '*',
              location: getLocation(path, commit)
            },
            ['location'],
            ['entry_id', 'version']
          )
        })
    })
}

/**
 * Normalize possible version strings to semver.
 */
function normalizeVersion (version: string) {
  // Correct `4.x` notation.
  version = version.replace(/\.x/, '.0')

  // Make it semver complete by appending `.0` when only two digits long.
  if (/^\d+\.\d+$/.test(version)) {
    version += '.0'
  }

  return version
}

function getLocation (path: string, commit: string) {
  return `github:DefinitelyTyped/DefinitelyTyped/${path.replace(/\\/g, '/')}#${commit}`
}
