import semver = require('semver')
import Promise = require('any-promise')
import db from '../../../support/knex'
import arrify = require('arrify')
import createError = require('http-errors')

export function getEntry (source: string, name: string) {
  return db('entries')
    .rightOuterJoin('versions', 'entries.id', 'versions.entry_id')
    .select(['entries.name', 'entries.source', 'entries.homepage', 'entries.description', 'entries.updated'])
    .select(db.raw('COUNT(entries.id) AS versions'))
    .where('entries.source', '=', source)
    .where('entries.name', '=', name)
    .whereNull('versions.deprecated')
    .groupBy('entries.id')
    .then(entries => {
      if (entries.length === 0) {
        return Promise.reject(createError(404, `No entry found for "${source}!${name}" in registry`))
      }

      // Patch versions to a number.
      const entry = entries[0]
      entry.versions = Number(entry.versions)
      return entry
    })
}

export function getTag (source: string, name: string, tag: string) {
  return db('versions')
    .select([
      'versions.version',
      'versions.location',
      'versions.description',
      'versions.tag',
      'versions.compiler',
      'versions.updated',
      'versions.deprecated'
    ])
    .join('entries', 'entries.id', 'versions.entry_id')
    .where('entries.source', '=', source)
    .where('entries.name', '=', name)
    .where('versions.tag', '=', tag)
    .then(tags => {
      if (tags.length === 0) {
        return Promise.reject(createError(404, `No entry found for "${source}!${name}" in registry`))
      }

      return tags[0]
    })
}

export interface Version {
  tag: string
  version: string
  description: string
  compiler: string
  location: string
  updated: Date
  deprecated: Date
}

/**
 * Sort two versions.
 */
export function sortVersions (a: Version, b: Version) {
  const result = semver.rcompare(a.tag, b.tag)

  if (result === 0) {
    return b.updated.getTime() - a.updated.getTime()
  }

  return result
}

/**
 * Find matching project versions.
 */
export function getVersions (source: string, name: string): Promise<Version[]> {
  return db('versions')
    .select([
      'versions.tag',
      'versions.version',
      'versions.description',
      'versions.compiler',
      'versions.location',
      'versions.updated',
      'versions.deprecated'
    ])
    .innerJoin('entries', 'entries.id', 'versions.entry_id')
    .where('entries.name', '=', name)
    .where('entries.source', '=', source)
    .whereNull('versions.deprecated')
    .orderBy('updated', 'desc')
    .then((results: Version[]) => {
      if (results.length === 0) {
        return Promise.reject(createError(404, `No versions found for "${source}!${name}" in registry`))
      }

      return results.sort(sortVersions)
    })
}

/**
 * Get the latest matching version.
 */
export function getMatchingVersions (source: string, name: string, version: string) {
  const range = semver.validRange(version)

  if (!range) {
    return Promise.reject(createError(400, `Invalid semver range "${version}"`))
  }

  return getVersions(source, name)
    .then(versions => {
      return versions.filter(x => semver.satisfies(x.version, range))
    })
}

/**
 * Retrieve the latest available version.
 */
export function getLatest (source: string, name: string, version?: string) {
  // Pick the first result.
  function result (versions: Version[]) {
    if (versions.length === 0) {
      const key = `${source}!${name}` + (version ? `@${version}` : '')

      return Promise.reject(createError(404, `No versions for "${key}" match in registry`))
    }

    return Promise.resolve(versions[0])
  }

  if (version) {
    return getMatchingVersions(source, name, version).then(result)
  }

  return getVersions(source, name).then(result)
}

export interface SearchOptions {
  query?: string
  name?: string
  offset?: number
  limit?: number
  sort?: string
  order?: string
  source?: string
}

export function search (options: SearchOptions) {
  const offset = Math.max(+options.offset || 0, 0)
  const limit = Math.max(Math.min(+options.limit || 20, 100), 1)
  const sort = options.sort || 'name'
  const order = options.order === 'desc' ? 'desc' : 'asc'

  const dbQuery = db('entries')
    .rightOuterJoin('versions', 'entries.id', 'versions.entry_id')
    .whereNull('versions.deprecated')

  if (options.query) {
    dbQuery.where(function () {
      this.whereRaw(`entries.name ILIKE '%' || ? || '%'`, [options.query])
      this.orWhereRaw(`entries.name ILIKE '%' || ? || '%'`, [options.query])
    })
  }

  if (options.name) {
    dbQuery.andWhere('entries.name', options.name)
  }

  // Override the sources search using `source=`.
  if (options.source) {
    dbQuery.where(function () {
      for (const source of arrify(options.source)) {
        this.orWhere('entries.source', source)
      }
    })
  }

  const totalQuery = dbQuery
    .clone()
    .select(db.raw('COUNT(DISTINCT entries.id)'))

  const searchQuery = dbQuery.clone()
    .select(['entries.name', 'entries.source', 'entries.homepage', 'entries.description', 'entries.updated'])
    .select(db.raw('COUNT(entries.id) AS versions'))
    .offset(offset)
    .limit(limit)

  if (options.query) {
    searchQuery.orderByRaw('ts_rank(tsv, plainto_tsquery(?)) DESC', [options.query])
  }

  searchQuery
    .orderBy(sort, order)
    .groupBy('entries.id')

  interface Result {
    name: string
    source: string
    homepage: string
    description: string
    rank: number
    updated: Date
    versions: string
  }

  return Promise.all<Result[], [{ count: string }]>([searchQuery, totalQuery])
    .then(([results, totals]) => {
      return {
        results: results.map(({ name, source, homepage, description, updated, versions }) => {
          return {
            name,
            source,
            homepage: homepage || getHomepage(source, name),
            description,
            updated,
            versions: Number(versions)
          }
        }),
        total: Number(totals[0].count)
      }
    })
}

/**
 * Get the default homepage for registry entries.
 */
function getHomepage (source: string, name: string) {
  if (source === 'npm') {
    return `https://www.npmjs.com/package/${name}`
  }

  if (source === 'github') {
    return `https://github.com/${name}`
  }
}
