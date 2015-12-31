import kue = require('kue')
import { join, sep } from 'path'
import thenify = require('thenify')
import glob = require('glob')
import fs = require('fs')
import Batch = require('batch')
import unthenify = require('unthenify')
import { cloneOrUpdate } from '../utils/git'
import { insertOrUpdate } from '../utils/db'

import * as PATHS from '../../support/constants/paths'

const repoPath = join(PATHS.DATA, 'registry')
const repoUrl = 'https://github.com/typings/registry.git'

const globify = thenify<string, glob.IOptions, string[]>(glob)
const readify = thenify<string, string, string>(fs.readFile)

/**
 * Job queue processing registry data.
 */
export default unthenify(function (job: kue.Job) {
  return cloneOrUpdate(repoPath, repoUrl)
    .then(() => processFiles(job))
})

/**
 * Process `typings` registry files.
 */
function processFiles (job: kue.Job) {
  return globify('{ambient,npm,github,bower,common}/*.json', { cwd: repoPath })
    .then(function (files) {
      const batch = new Batch<any>()

      batch.concurrency(10)

      files.forEach(path => {
        batch.push(unthenify(() => processFile(path)))
      })

      batch.on('progress', (event: any) => {
        job.progress(event.complete, event.total)
      })

      return thenify(done => batch.end(done))()
    })
}

/**
 * Process a registry entry.
 */
function processFile (path: string) {
  // Build up parts since npm registry has scopes (E.g. `@foo/bar`).
  const parts = path.split(sep)
  const source = parts.shift()
  const name = parts.join('/').replace(/\.json$/, '')

  return readify(join(repoPath, path), 'utf8')
    .then(data => JSON.parse(data))
    .then(entry => {
      const homepage = entry.homepage || getHomepage(source, name)

      return insertOrUpdate(
        'entries',
        { name, source, homepage },
        ['homepage'],
        ['name', 'source'],
        'id'
      )
        .then((id: string) => {
          const versions = Object.keys(entry.versions)

          return Promise.all(versions.map(version => {
            const data = entry.versions[version]
            const info: any = { entry_id: id, version }

            if (typeof data === 'string') {
              info.location = data
            } else {
              info.compiler = data.compiler
              info.location = data.location
              info.description = data.description
            }

            return insertOrUpdate(
              'versions',
              info,
              ['location', 'compiler', 'description'],
              ['entry_id', 'version']
            )
          }))
        })
    })
}

/**
 * Get the default location for registry items.
 */
function getHomepage (source: string, name: string) {
  if (source === 'npm') {
    return `https://www.npmjs.com/package/${name}`
  }

  if (source === 'github') {
    return `https://github.com/${name}`
  }
}
