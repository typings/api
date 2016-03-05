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
  returning?: string
}

export function upsert (options: UpsertOptions): Promise<string> {
  const insert = db(options.table)
    .insert(options.insert)
    .transacting(options.trx)
    .toString() +
    ` ON CONFLICT (${options.conflicts.join(', ')}) DO UPDATE SET ` +
    options.updates.map(key => `${key}=excluded.${key}`) +
    (options.where ? ` WHERE ${options.where}` : '') +
    (options.returning ? ` RETURNING ${options.returning}` : '')

  return db.raw(insert).then(function (response) {
    const { rows } = response

    return rows.length ? rows[0][options.returning] : undefined
  })
}

export interface EntryAndVersionOptions {
  name: string,
  source: string,
  homepage?: string,
  updated: Date,
  version: string,
  compiler?: string,
  location?: string
}

export interface VersionOptions {
  entryId: string,
  updated: Date,
  version: string,
  compiler?: string,
  location?: string
}

export interface EntryOptions {
  name: string,
  source: string,
  homepage?: string,
  updated: Date
}

export function createEntry (options: EntryOptions): Promise<string> {
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
    returning: 'id',
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

export function createVersion (options: VersionOptions): Promise<string> {
  const { entryId, version, compiler, location, updated } = options
  const tag = `${version}+${getTimestamp(updated)}` + (compiler ? `-${compiler}` : '')

  if (!semver.valid(tag)) {
    return Promise.reject<string>(new Error(`Invalid tag: ${tag}`))
  }

  return upsert({
    table: 'versions',
    insert: {
      entry_id: entryId,
      tag,
      version,
      compiler,
      location,
      updated
    },
    updates: ['version', 'location', 'updated', 'compiler'],
    conflicts: ['entry_id', 'tag'],
    returning: 'id',
    where: 'versions.updated <= excluded.updated'
  })
}

export function createEntryAndVersion (options: EntryAndVersionOptions): Promise<string> {
  const { name, source, updated, version, compiler, location } = options

  return createEntry(options)
    .then((id: string) => {
      if (id != null) {
        return id
      }

      return db('entries')
        .first('id')
        .where({ name, source })
        .then(row => row.id)
    })
    .then((entryId: string) => {
      return createVersion({ entryId, updated, version, compiler, location })
    })
}

export interface VersionsOptions {
  name: string,
  source: string,
  updated: Date
}

export function deleteVersions (options: VersionsOptions) {
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
          .del()
          .where('entry_id', '=', row.id)
          .andWhere('updated', '<', updated)
          .returning('id')
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
}
