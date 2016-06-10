import knex = require('knex')
import Promise = require('any-promise')
import semver = require('semver')
import pad = require('pad-left')
import db from '../../../support/knex'

export interface UpsertOptions {
  table: string
  insert: { [key: string]: string | number | boolean | Date }
  updates: string[]
  conflicts: string[]
  trx?: knex.Transaction
  where?: string
  returning?: string[]
}

export function upsert (options: UpsertOptions): Promise<Object> {
  const insert = db(options.table)
    .insert(options.insert)
    .transacting(options.trx)
    .toString() +
    ` ON CONFLICT (${options.conflicts.join(', ')}) DO UPDATE SET ` +
    options.updates.map(key => `${key}=excluded.${key}`) +
    (options.where ? ` WHERE ${options.where}` : '') +
    (options.returning ? ` RETURNING ${options.returning.join(', ')}` : '')

  return db.raw(insert).then(function (response) {
    const { rows } = response

    return rows.length ? rows[0] : undefined
  })
}

export interface EntryAndVersionOptions {
  name: string
  source: string
  homepage?: string
  updated: Date
  version: string
  compiler?: string
  location?: string
}

export interface VersionOptions {
  entryId: string
  updated: Date
  version: string
  compiler?: string
  location?: string
  description?: string
}

export interface EntryOptions {
  name: string
  source: string
  homepage?: string
  updated: Date
}

export function createEntry (options: EntryOptions): Promise<{ id: string }> {
  const { name, source, homepage, updated } = options

  return upsert({
    table: 'entries',
    insert: {
      name,
      source,
      homepage,
      updated
    },
    updates: ['homepage', 'updated'],
    conflicts: ['name', 'source'],
    returning: ['id'],
    where: 'entries.updated <= excluded.updated'
  })
}

function getTimestamp (date: Date): string {
  return '' + date.getUTCFullYear() +
    pad(String(date.getUTCMonth() + 1), 2, '0') +
    pad(String(date.getUTCDate()), 2, '0') +
    pad(String(date.getUTCHours()), 2, '0') +
    pad(String(date.getUTCMinutes()), 2, '0') +
    pad(String(date.getUTCSeconds()), 2, '0')
}

export function createVersion (options: VersionOptions): Promise<{ id: string }> {
  const { entryId, version, compiler, location, updated, description } = options
  const tag = `${version}+${getTimestamp(updated)}` + (compiler ? `-${compiler}` : '')

  if (!semver.valid(tag)) {
    return Promise.reject<any>(new TypeError(`Invalid tag: ${tag}`))
  }

  return upsert({
    table: 'versions',
    insert: {
      entry_id: entryId,
      tag,
      version,
      compiler,
      location,
      updated,
      description,
      deprecated: null
    },
    updates: ['version', 'location', 'updated', 'description', 'compiler', 'deprecated'],
    conflicts: ['entry_id', 'tag'],
    returning: ['id'],
    where: 'versions.updated <= excluded.updated'
  })
    .then((row: any) => {
      if (row) {
        // Deprecate old, duplicate locations.
        return db('versions')
          .update({ deprecated: updated })
          .where('id', '!=', row.id)
          .where('location', '=', location)
          .where('updated', '<=', updated)
      }

      return row
    })
}

export function createAndGetEntry (options: EntryOptions) {
  const { name, source } = options

  return createEntry(options)
    .then((row) => {
      if (row == null) {
        return db('entries')
          .first('id')
          .where({ name, source })
      }

      return row
    })
}

export function createEntryAndVersion (options: EntryAndVersionOptions): Promise<{ id: string }> {
  const { updated, version, compiler, location } = options

  return createAndGetEntry(options)
    .then(({ id }) => {
      return createVersion({
        entryId: id,
        updated,
        version,
        compiler,
        location
      })
    })
}

export interface VersionsOptions {
  name: string,
  source: string,
  updated: Date
}

export function deprecateOldVersions (options: VersionsOptions) {
  const { name, source, updated } = options

  return db.transaction(trx => {
    return db('entries')
      .transacting(trx)
      .first('id')
      .where({ name, source })
      .then((row) => {
        if (row == null) {
          return
        }

        return db('versions')
          .transacting(trx)
          .update({ deprecated: updated })
          .where('entry_id', '=', row.id)
          .andWhere('updated', '<', updated)
          .returning('id')
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
}

interface VersionsLikeOptions {
  location: string
  updated: Date
}

export function deprecateOldVersionsLike (options: VersionsLikeOptions) {
  const { location, updated } = options

  return db('versions')
    .update({ deprecated: updated })
    .where('location', 'LIKE', location)
    .andWhere('updated', '<', updated)
}

interface EntryVersionsNotInOptions {
  entryId: string
  updated: Date
  locations: string[]
}

export function deprecateOldEntryVersionsNotIn (options: EntryVersionsNotInOptions) {
  const { entryId, locations, updated } = options

  return db('versions')
    .update({ deprecated: updated })
    .where('entry_id', entryId)
    .where('updated', '<', updated)
    .whereNotIn('location', locations)
}
