import fs = require('fs')
import cp = require('child_process')
import thenify = require('thenify')

const statify = thenify(fs.stat)
const execify = thenify<string, Object, [Buffer, Buffer]>(cp.exec)

/**
 * Clone or update a repo path.
 */
export function cloneOrUpdate (path: string, repo: string) {
  return statify(path)
    .then(
      (stats) => stats.isDirectory() ? update(path) : clone(path, repo),
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
 * Get the latest commit on a certain file.
 */
export function latestCommit (repoPath: string, filePath: string) {
  return execify(`git log -1 --pretty="%H" -- ${filePath}`, { cwd: repoPath })
    .then(([commit]) => String(commit).trim())
}
