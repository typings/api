import fs = require('fs')
import cp = require('child_process')
import stream = require('stream')
import thenify = require('thenify')
import split = require('split')

const statify = thenify(fs.stat)
const execify = thenify<string, Object, [string, string]>(cp.exec)

const lastUpdated: { [path: string]: number } = {}

/**
 * Clone or update a repo path.
 */
export function updateOrClone (path: string, repo: string, timeout: number) {
  const now = Date.now()
  const updated = lastUpdated[path] || 0

  return statify(path)
    .then<any>(
      (stats) => {
        if (stats.isDirectory()) {
          // Only update if time has elasped.
          if (updated + timeout < now) {
            return update(path).then(function () {
              lastUpdated[path] = now
            })
          }

          return
        }

        return clone(path, repo)
      },
      () => clone(path, repo)
    )
}

/**
 * Update a repo contents.
 */
export function update (path: string) {
  return execify('git pull', { cwd: path })
}

/**
 * Clone a repo contents to path.
 */
export function clone (path: string, repo: string) {
  return execify(`git clone ${repo} ${path}`, {})
}

/**
 * Get commits since an existing commit hash.
 */
export function commitsSince (cwd: string, commit?: string): stream.Transform {
  const stream = cp.spawn('git', ['rev-list', '--reverse', commit ? `${commit}..HEAD` : 'HEAD'], { cwd })

  return stream.stdout.pipe(split(null, null, { trailing: false }))
}

/**
 * Get the files changes made by a commit.
 */
export function commitFilesChanged (cwd: string, commit: string) {
  return execify(`git show --pretty="format:" --name-status --diff-filter=ADM ${commit}`, { cwd })
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

    stream.stdout.on('error', reject)
    stream.stdout.on('end', () => resolve(data))
  })
}
