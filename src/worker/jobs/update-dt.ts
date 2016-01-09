import kue = require('kue')
import { join, basename } from 'path'
import fs = require('fs')
import thenify = require('thenify')
import unthenify = require('unthenify')
import glob = require('glob')
import Batch = require('batch')
import Promise = require('native-or-bluebird')
import { DATA_PATH } from '../../support/constants'

import { cloneOrUpdate, latestCommit } from '../utils/git'
import { insertOrUpdate } from '../utils/db'

const repoPath = join(DATA_PATH, 'DefinitelyTyped')
const repoUrl = 'https://github.com/DefinitelyTyped/DefinitelyTyped.git'

const globify = thenify<string, glob.IOptions, string[]>(glob)
const readify = thenify<string, string, string>(fs.readFile)

const VERSION_REGEXP_STRING = '\\d+\\.(?:\\d+|x)(?:\\.(?:\\d+|x)(?:\\-[^\\-\\s]+)?)?'

const DT_CONTENT_VERSION_REGEXP = new RegExp(`Type definitions for .* v?(${VERSION_REGEXP_STRING})$`, 'im')
const DT_CONTENT_PROJECT_REGEXP = /^\/\/ *Project: *([^\s]+)/im
const DT_FILE_VERSION_REGEXP = new RegExp(`-${VERSION_REGEXP_STRING}$`)

/**
 * Job queue processing DefinitelyTyped repo data.
 */
export default unthenify(function (job: kue.Job) {
  return cloneOrUpdate(repoPath, repoUrl).then(() => processFiles(job))
})

/**
 * Process all DefinitelyTyped definitions into the
 */
function processFiles (job: kue.Job) {
  return globify('*/*.d.ts', { cwd: repoPath })
    .then(function (files) {
      const batch = new Batch<any>()

      batch.concurrency(5)

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
 * Process a file from DefinitelyTyped and insert into database.
 */
function processFile (path: string) {
  const source = 'dt'
  const filename = basename(path, '.d.ts')
  const name = filename.replace(DT_FILE_VERSION_REGEXP, '')
  let version: string
  let homepage: string

  if (name !== filename) {
    version = normalizeVersion(filename.substr(name.length + 1))
  }

  return Promise.all<string, string>([
    latestCommit(repoPath, path),
    readify(join(repoPath, path), 'utf8')
  ])
    .then(function ([commit, contents]) {
      const contentVersion = DT_CONTENT_VERSION_REGEXP.exec(contents)
      const contentHomepage = DT_CONTENT_PROJECT_REGEXP.exec(contents)

      // Override with the version specified in the `.d.ts` file.
      if (contentVersion) {
        version = normalizeVersion(contentVersion[1])
      }

      if (contentHomepage) {
        homepage = contentHomepage[1].trim()
      }

      return insertOrUpdate(
        'entries',
        { name, source, homepage },
        ['homepage'],
        ['name', 'source'],
        'id'
      )
        .then((id: string) => {
          const location = `github:DefinitelyTyped/DefinitelyTyped/${path.replace(/\\/g, '/')}#${commit}`

          // Make sure `version` is always set, default to `*`.
          version = version || '*'

          return insertOrUpdate(
            'versions',
            { entry_id: id, version, location },
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
