import semver = require('semver')
import throat = require('throat')
import { Minimatch } from 'minimatch'
import { join, dirname, basename } from 'path'
import debug from '../support/debug'
import { repo, commitsSince, commitFilesChanged, getFile, getDate } from '../support/git'
import { createEntryAndVersion, deprecateOldVersionsLike, getLatestCommit, createCommit } from '../support/db'
import { REPO_DT_PATH, REPO_DT_URL } from '../support/constants'

const VERSION_REGEXP_STRING = '\\d+\\.(?:\\d+\\+?|x)(?:\\.(?:\\d+|x)(?:\\-[^\\-\\s]+)?)?'

const DT_CONTENT_VERSION_REGEXP = new RegExp(`^\/\/ *Type definitions for.+?v?(${VERSION_REGEXP_STRING})`, 'im')
const DT_CONTENT_PROJECT_REGEXP = /^\/\/ *Project: *([^\s]+)/im
const DT_FILE_VERSION_REGEXP = new RegExp(`-${VERSION_REGEXP_STRING}$`)

const DEFINITION_PATHS = new Minimatch('**/*.d.ts')

const indexCommit = throat(1, async function (commit: string) {
  debug(`index commit: ${commit}`)

  const files = await commitFilesChanged(REPO_DT_PATH, commit)

  await Promise.all(files.map(async (change) => {
    const [type, path] = change
    const matched = DEFINITION_PATHS.match(path)

    debug(`change (${matched ? 'matched' : 'not matched'}): ${change[0]} ${change[1]}`)

    if (!matched) {
      return undefined
    }

    if (type[0] === 'A' || type[0] === 'M') {
      return indexFile(commit, 'A', path)
    }

    if (type[0] === 'D') {
      return indexFile(commit, 'D', path)
    }

    console.error(`Unknown change: ${commit} "${change.join(' ')}"`)
  }))

  await createCommit(REPO_DT_URL, commit)
})

const indexFile = throat(10, async function (commit: string, type: 'A' | 'D', path: string) {
  if (type === 'D') {
    const updated = await getDate(REPO_DT_PATH, commit)

    return await deprecateOldVersionsLike({
      updated,
      location: getLocation(path, '%')
    })
  }

  let hasTsconfigJson = false
  const fullpath = path.toLowerCase().replace(/\.d\.ts$/, '')
  const fullname = fullpath.replace(DT_FILE_VERSION_REGEXP, '')
  let name = normalizeLegacyName(fullname)
  let version = '0.0.0'
  let homepage: string

  // Extract the version from the filename.
  if (fullpath !== fullname) {
    version = normalizeVersion(fullpath.substr(fullname.length + 1)) || version
  }

  try {
    hasTsconfigJson = !!(await getFile(REPO_DT_PATH, join(dirname(path), 'tsconfig.json'), commit, 100))
  } catch (err) {
    debug(`missing config file: ${commit} ${path}`)
  }

  // Handle new 2.0 repo structure.
  if (hasTsconfigJson) {
    name = dirname(fullpath)

    if (
      basename(fullname) !== dirname(fullname) &&
      basename(fullname) !== 'index' &&
      version === '0.0.0'
    ) {
      debug(`skipping path with config: ${commit} ${path}`)
      return
    }
  }

  const contents = await getFile(REPO_DT_PATH, path, commit, 1024)
  const contentVersion = DT_CONTENT_VERSION_REGEXP.exec(contents)
  const contentHomepage = DT_CONTENT_PROJECT_REGEXP.exec(contents)

  // Update the known project version.
  if (contentVersion) {
    version = normalizeVersion(contentVersion[1]) || version
  }

  if (contentHomepage) {
    homepage = contentHomepage[1]
  }

  const updated = await getDate(REPO_DT_PATH, commit)

  // Automatically deprecates old versions.
  await Promise.all([
    createEntryAndVersion({
      name,
      updated,
      homepage,
      version,
      source: 'dt',
      compiler: undefined,
      location: getLocation(path, commit)
    }),
    deprecateOldVersionsLike({
      updated,
      location: getLocation(path, '%')
    })
  ])
})

async function exec () {
  const latest = await getLatestCommit(REPO_DT_URL)

  await repo(REPO_DT_PATH, REPO_DT_URL, 'master')

  debug(`restarting from ${latest ? latest.commit : 'beginning'}`)

  const since = await commitsSince(REPO_DT_PATH, latest ? latest.commit : undefined)

  debug(`indexing ${since.length} commits`)

  await Promise.all(since.map(commit => {
    return indexCommit(commit)
  }))
}

exec()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

/**
 * Normalize possible version strings to semver.
 */
function normalizeVersion (version: string) {
  // Correct `4.x` notation.
  version = version.replace(/\.x(?=$|\.)/g, '.0')

  // Correct `1.4+` notation.
  version = version.replace(/\+$/, '.0')

  // Make it semver complete by appending `.0` when only two digits long.
  if (/^\d+\.\d+$/.test(version)) {
    version += '.0'
  }

  return semver.valid(version)
}

/**
 * Normalize the legacy DefinitelyTyped structure (pre-2.0).
 */
function normalizeLegacyName (name: string): string {
  const parts = name.split('/')

  if (parts.length === 1) {
    return parts[0]
  }

  if (parts.length === 2) {
    const dir = sanitizeName(parts[0])
    const file = sanitizeName(parts[1])

    // "google.maps/google-maps.d.ts"
    if (dir === file) {
      return parts[1]
    }

    // "react/react-dom.d.ts"
    if (parts[1].substr(0, dir.length) === dir) {
      return parts[1]
    }

    return name
  }

  return name
}

/**
 * Get the Typings location for DefinitelyTyped typings.
 */
function getLocation (path: string, commit: string) {
  return `github:DefinitelyTyped/DefinitelyTyped/${path}#${commit}`
}

/**
 * Strip extra name characters for comparison.
 */
function sanitizeName (name: string) {
  return name.replace(/[-\.]|js$/g, '')
}
