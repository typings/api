import fs = require('fs')
import cp = require('child_process')
import thenify = require('thenify')
import split = require('split')
import { join } from 'path'
import debug from './debug'

const statify = thenify(fs.stat)
const execify = thenify<string, Object, [string, string]>(cp.exec)

/**
 * Clone or update a repo path.
 */
export function repo (cwd: string, repo: string, branch: string) {
  return statify(cwd)
    .then(
      (stats) => {
        if (stats.isDirectory()) {
          return undefined
        }

        throw new TypeError(`"${cwd}" already exists`)
      },
      () => clone(cwd, repo)
    )
    .then(() => update(cwd, repo, branch))
}

/**
 * Clone a repo contents to path.
 */
export function clone (cwd: string, repo: string) {
  debug('git clone: %s %s', repo, cwd)

  return execify(`git clone ${repo} ${cwd}`, {})
}

/**
 * Update a repo contents.
 */
export function update (cwd: string, repo: string, branch: string) {
  debug('git update: %s', cwd)

  return execify(
    `git checkout ${branch} && git fetch origin ${branch} && git reset --hard origin/${branch}`,
    { cwd }
  )
}

/**
 * Get commits since an existing commit hash.
 */
export function commitsSince (cwd: string, commit?: string) {
  return new Promise<string[]>((resolve, reject) => {
    const stream = cp.spawn('git', ['rev-list', '--reverse', commit ? `${commit}..HEAD` : 'HEAD'], { cwd })
    const commits: string[] = []

    debug('git rev-list: %s %s', commit, cwd)

    stream.on('error', reject)
    stream.stdout.on('error', reject)
    stream.stdout.pipe(split(null, null, { trailing: false }))
      .on('data', function (line: string) {
        commits.push(line)
      })
      .on('end', function () {
        return resolve(commits)
      })
  })
}

/**
 * Get the files changes made by a commit.
 */
export function commitFilesChanged (cwd: string, commit: string) {
  debug('git show: %s %s', commit, cwd)

  return execify(`git show --pretty="format:" --name-status --no-renames --diff-filter=ADMRC ${commit}`, { cwd })
    .then(([stdout]) => {
      const out = stdout.trim()

      if (out.length === 0) {
        return []
      }

      return out.split(/\r?\n/).map(line => line.split('\t'))
    })
}

/**
 * Get file contents at a commit hash.
 */
export function getFile (cwd: string, path: string, commit: string, maxBuffer: number) {
  debug('git show file: %s %s %s', commit, maxBuffer, join(cwd, path))

  return new Promise<string>((resolve, reject) => {
    const stream = cp.spawn('git', ['show', `${commit}:${path}`], { cwd })
    let data = ''
    let length = 0

    stream.stdout.on('data', (chunk: Buffer) => {
      // Discard additional output.
      if (length >= maxBuffer) {
        return
      }

      const len = Math.min(chunk.length, maxBuffer - length)

      data += chunk.toString('utf8', 0, len)
      length += len
    })

    stream.on('error', reject)
    stream.stdout.on('error', reject)
    stream.stdout.on('end', () => resolve(data))
  })
}

/**
 * Get the date when a commit occured.
 */
export function getDate (cwd: string, commit: string) {
  return execify(`git show -s --format=%ci ${commit}`, { cwd })
    .then(([stdout]) => new Date(stdout))
}
