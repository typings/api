import arrify = require('arrify')
import throat = require('throat')
import semver = require('semver')
import { Minimatch } from 'minimatch'
import debug from '../../support/debug'
import { repo, commitsSince, commitFilesChanged, getFile, getDate } from '../../support/git'
import { REPO_TYPINGS_PATH, REPO_TYPINGS_URL } from '../../support/constants'
import {
  createAndGetEntry,
  createVersion,
  VersionOptions,
  deprecateOldVersions,
  deprecateOldEntryVersionsNotIn,
  getLatestCommit,
  createCommit
} from '../../support/db'

const REGISTRY_PATHS = new Minimatch('{npm,github,bower,common,shared,lib,env,global}/**/*.json')

const indexFile = throat(10, async function (commit: string, type: 'A' | 'D', path: string) {
  // Build up parts since npm registry has scopes (E.g. `@foo/bar`).
  const parts: string[] = path.replace(/\.json$/, '').split('/')
  const source = parts.shift()
  const name = parts.join('/')

  // Handle deletions.
  if (type === 'D') {
    const updated = await getDate(REPO_TYPINGS_PATH, commit)

    return await deprecateOldVersions({ name, source, updated })
  }

  let entry: any

  try {
    entry = JSON.parse(await getFile(REPO_TYPINGS_PATH, path, commit, 1024 * 400))
  } catch (err) {
    console.error(`skipping: ${commit} ${path} (${err.message})`)
    return
  }

  const { homepage, versions } = entry

  // Skip iterations where versions does not exist (E.g. old commits).
  if (typeof versions !== 'object') {
    return
  }

  const updated = await getDate(REPO_TYPINGS_PATH, commit)

  const row = await createAndGetEntry({
    name,
    homepage,
    source,
    updated
  })

  const data: VersionOptions[] = []

  Object.keys(versions).forEach((version) => {
    const values = arrify(versions[version])

    // Skip invalid versions.
    if (!semver.valid(version)) {
      console.error(`skipping invalid version: ${commit} ${path} "${version}"`)
      return
    }

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

  await Promise.all(data.map(data => createVersion(data)))

  await deprecateOldEntryVersionsNotIn({
    entryId: row.id,
    updated,
    locations: data.map(x => x.location)
  })
})

const indexCommit = throat(1, async function (commit: string) {
  debug(`index commit: ${commit}`)

  const files = await commitFilesChanged(REPO_TYPINGS_PATH, commit)

  await Promise.all(files.map(async (change) => {
    const [type, path] = change
    const matched = REGISTRY_PATHS.match(path)

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

  await createCommit(REPO_TYPINGS_URL, commit)
})

export async function exec () {
  const latest = await getLatestCommit(REPO_TYPINGS_URL)

  await repo(REPO_TYPINGS_PATH, REPO_TYPINGS_URL, 'master')

  debug(`restarting from ${latest ? latest.commit : 'beginning'}`)

  const since = await commitsSince(REPO_TYPINGS_PATH, latest ? latest.commit : undefined)

  debug(`indexing ${since.length} commits`)

  await Promise.all(since.map(commit => {
    return indexCommit(commit)
  }))

  return since
}
