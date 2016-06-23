import kue = require('kue')
import thenify = require('thenify')
import arrify = require('arrify')
import { Minimatch } from 'minimatch'
import { repoUpdated, commitsSince, commitFilesChanged, getFile, getDate } from './support/git'
import {
  createAndGetEntry,
  createVersion,
  VersionOptions,
  deprecateOldVersions,
  deprecateOldEntryVersionsNotIn
} from './support/db'
import queue from '../../support/kue'

import {
  REPO_TYPINGS_PATH,
  REPO_TYPINGS_URL,
  JOB_INDEX_TYPINGS_COMMIT,
  JOB_INDEX_TYPINGS_FILE_CHANGE,
  TIMEOUT_REPO_POLL
} from '../../support/constants'

const registryPaths = new Minimatch('{npm,github,bower,common,shared,lib,env,global}/**/*.json')

export interface TypingsUpdateJobData {
  commit: string
}

export interface TypingsChangeJobData {
  commit: string
  change: [string, string]
}

/**
 * Job queue processing registry data.
 */
export function updateTypings (job: kue.Job<TypingsUpdateJobData>) {
  return repoUpdated(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => processCommits(job))
}

/**
 * Process commits since last job.
 */
function processCommits (job: kue.Job<TypingsUpdateJobData>) {
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

export function indexTypingsCommit (job: kue.Job<TypingsUpdateJobData>) {
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

export function indexTypingsFileChange (job: kue.Job<TypingsChangeJobData>) {
  const { change, commit } = job.data
  const [ type, path ] = change

  // Build up parts since npm registry has scopes (E.g. `@foo/bar`).
  const parts: string[] = path.replace(/\.json$/, '').split('/')
  const source = parts.shift()
  const name = parts.join('/')

  if (type === 'D') {
    return getDate(REPO_TYPINGS_PATH, commit)
      .then(updated => {
        return deprecateOldVersions({ name, source, updated })
      })
  }

  return repoUpdated(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, TIMEOUT_REPO_POLL)
    .then(() => getFile(REPO_TYPINGS_PATH, path, commit, 1024 * 400))
    .then(data => JSON.parse(data))
    .then(entry => {
      const { homepage, versions } = entry

      // Skip iterations where versions does not exist (E.g. old commits).
      if (typeof versions !== 'object') {
        return
      }

      return getDate(REPO_TYPINGS_PATH, commit)
        .then(updated => {
          return createAndGetEntry({
            name,
            homepage,
            source,
            updated
          })
            .then((row) => {
              const data: VersionOptions[] = []

              Object.keys(versions).forEach((version) => {
                const values = arrify(versions[version])

                for (const value of values) {
                  if (typeof value === 'string') {
                    data.push({
                      version,
                      entryId: row.id,
                      location: value,
                      updated
                    })
                  } else {
                    data.push({
                      version,
                      entryId: row.id,
                      compiler: value.compiler,
                      location: value.location,
                      description: value.description,
                      updated
                    })
                  }
                }
              })

              return Promise.all(data.map(data => createVersion(data)))
                .then(() => {
                  return deprecateOldEntryVersionsNotIn({
                    entryId: row.id,
                    updated,
                    locations: data.map(x => x.location)
                  })
                })
            })
        })
    })
}
