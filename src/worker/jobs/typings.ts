import kue = require('kue')
import { sep } from 'path'
import thenify = require('thenify')
import { Minimatch } from 'minimatch'
import arrify = require('arrify')
import { updateOrClone, commitsSince, commitFilesChanged, getFile } from './support/git'
import { insertOrUpdate } from './support/db'
import queue from '../../support/kue'
import db from '../../support/knex'

import {
  REPO_TYPINGS_PATH,
  REPO_TYPINGS_URL,
  JOB_INDEX_TYPINGS_COMMIT,
  JOB_INDEX_TYPINGS_FILE_CHANGE,
  TIMEOUT_REPO_POLL
} from '../../support/constants'

const registryPaths = new Minimatch('{ambient,npm,github,bower,common}/**/*.json')

/**
 * Job queue processing registry data.
 */
export function updateTypings (job: kue.Job) {
  return updateOrClone(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => processCommits(job))
}

/**
 * Process commits since last job.
 */
function processCommits (job: kue.Job) {
  return new Promise((resolve, reject) => {
    let { commit } = job.data
    const stream = commitsSince(REPO_TYPINGS_PATH, commit)

    stream.on('data', function (currentCommit: string) {
      commit = currentCommit

      const job = queue.create(JOB_INDEX_TYPINGS_COMMIT, { commit })
      job.removeOnComplete(true)
      job.save()
    })

    stream.on('error', reject)
    stream.on('end', () => resolve({ commit }))
  })
}

export function indexTypingsCommit (job: kue.Job) {
  const { commit } = job.data

  return commitFilesChanged(REPO_TYPINGS_PATH, commit)
    .then(files => {
      return Promise.all(files.map(change => {
        if (!registryPaths.match(change[1])) {
          return
        }

        return thenify(cb => {
          const job = queue.createJob(JOB_INDEX_TYPINGS_FILE_CHANGE, { change, commit })
          job.removeOnComplete(true)
          job.save(cb)
        })()
      }))
    })
}

export function indexTypingsFileChange (job: kue.Job) {
  const { change, commit } = job.data
  const [type, path] = change

  // Build up parts since npm registry has scopes (E.g. `@foo/bar`).
  const parts = path.split(sep)
  const source = parts.shift()
  const name = parts.join('/').replace(/\.json$/, '')

  if (type === 'D') {
    return db.transaction(trx => {
      return db('versions')
        .transacting(trx)
        .del()
        .innerJoin('entries', 'entries.id', 'versions.entry_id')
        .where('entries.name', '=', name)
        .then(() => {
          return db('entries')
            .transacting(trx)
            .where('name', '=', name)
            .del()
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
  }

  return getFile(REPO_TYPINGS_PATH, path, commit, 1024 * 400)
    .then(data => JSON.parse(data))
    .then(entry => {
      const { homepage, versions } = entry

      // Skip iterations where versions does not exist.
      if (!versions) {
        return
      }

      return insertOrUpdate(
        'entries',
        { name, source, homepage },
        ['homepage'],
        ['name', 'source'],
        'id'
      )
        .then((id: string) => {
          const inserts: any[] = []

          for (const version of Object.keys(versions)) {
            const data: any = versions[version]

            for (const value of arrify(data)) {
              const info: any = { entry_id: id, version }

              if (typeof value === 'string') {
                info.location = value
              } else {
                info.compiler = value.compiler
                info.location = value.location
                info.description = value.description
              }

              inserts.push(info)
            }
          }

          return Promise.all(inserts.map(insert => {
            return insertOrUpdate(
              'versions',
              insert,
              ['location', 'compiler', 'description'],
              ['entry_id', 'version']
            )
          }))
            .then(() => {
              return db('versions')
                .del()
                .whereNotIn('location', inserts.map(x => x.location))
            })
        })
    })
}
