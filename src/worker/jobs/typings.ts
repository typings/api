import kue = require('kue')
import { sep } from 'path'
import thenify = require('thenify')
import { Minimatch } from 'minimatch'
import arrify = require('arrify')
import { repoUpdated, commitsSince, commitFilesChanged, getFile, getDate } from './support/git'
import { upsert } from './support/db'
import queue from '../../support/kue'
import db from '../../support/knex'

import {
  REPO_TYPINGS_PATH,
  REPO_TYPINGS_URL,
  JOB_INDEX_TYPINGS_COMMIT,
  JOB_INDEX_TYPINGS_FILE_CHANGE,
  TIMEOUT_REPO_POLL
} from '../../support/constants'

const registryPaths = new Minimatch('{npm,github,bower,common,shared,lib,env,global}/**/*.json')

/**
 * Job queue processing registry data.
 */
export function updateTypings (job: kue.Job) {
  return repoUpdated(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => processCommits(job))
}

/**
 * Process commits since last job.
 */
function processCommits (job: kue.Job) {
  const { commit } = job.data

  return commitsSince(REPO_TYPINGS_PATH, commit)
    .then(function (commits) {
      return Promise.all(commits.map(function (commit) {
        const commitJob = queue.create(JOB_INDEX_TYPINGS_COMMIT, { commit })
        commitJob.removeOnComplete(true)
        return thenify(cb => commitJob.save(cb))()
      }))
        .then(() => {
          return {
            commit: commits.pop() || commit
          }
        })
    })
}

export function indexTypingsCommit (job: kue.Job) {
  const { commit } = job.data

  return repoUpdated(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => commitFilesChanged(REPO_TYPINGS_PATH, commit))
    .then(files => {
      return Promise.all(files.map(change => {
        const matched = registryPaths.match(change[1])

        job.log(`Change (${matched ? 'matched' : 'not matched'}): ${change[0]} ${change[1]}`)

        if (!matched) {
          return
        }

        return thenify(cb => {
          const fileJob = queue.createJob(JOB_INDEX_TYPINGS_FILE_CHANGE, { change, commit })
          fileJob.removeOnComplete(true)
          fileJob.save(cb)
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
    return db('entries')
      .update({ active: false })
      .where({ name, source })
  }

  return repoUpdated(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => getFile(REPO_TYPINGS_PATH, path, commit, 1024 * 400))
    .then(data => JSON.parse(data))
    .then(entry => {
      const { homepage, versions } = entry

      // Skip iterations where versions does not exist (E.g. old commits).
      if (!versions) {
        return
      }

      return upsert(
        'entries',
        { name, source, homepage, active: true },
        ['homepage', 'active'],
        ['name', 'source'],
        null,
        'id'
      )
        .then((id: string) => {
          return getDate(REPO_TYPINGS_PATH, commit)
            .then(commitDate => {
              const inserts: any[] = []

              for (const version of Object.keys(versions)) {
                const data: any = versions[version]

                for (const value of arrify(data)) {
                  const info: any = { entry_id: id, version, updated: commitDate.toUTCString() }

                  if (typeof value === 'string') {
                    info.location = value
                    info.compiler = '*'
                  } else {
                    info.compiler = value.compiler || '*'
                    info.location = value.location
                    info.description = value.description
                  }

                  inserts.push(info)
                }
              }

              return db.transaction(trx => {
                return Promise.all(inserts.map(insert => {
                  return db('versions')
                    .transacting(trx)
                    .first('updated')
                    .where({ entry_id: id, version: insert.version, compiler: insert.compiler })
                    .then((entry) => {
                      if (entry && entry.updated > commitDate) {
                        return
                      }

                      return upsert(
                        'versions',
                        insert,
                        ['location', 'description', 'updated'],
                        ['entry_id', 'version', 'compiler']
                      )
                    })
                }))
                  .then(() => {
                    return db('versions')
                      .transacting(trx)
                      .del()
                      .where('entry_id', id)
                      .whereNotIn('location', inserts.map(x => x.location))
                  })
                  .then(trx.commit, trx.rollback)
              })
            })
        })
    })
}
