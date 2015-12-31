import unthenify = require('unthenify')
import db from '../support/knex'

export const up = unthenify(function () {
  return db.raw('ALTER TABLE entries ADD COLUMN tsv tsvector')
    .then(() => db.raw('CREATE INDEX tsv_index ON entries USING gin(tsv)'))
    .then(() => {
      return db.raw(`
UPDATE entries SET tsv =
  setweight(to_tsvector(name), 'A') ||
  setweight(to_tsvector(coalesce(description, '')), 'B') ||
  setweight(to_tsvector(coalesce(homepage, '')), 'D')
`)
    })
    .then(() => {
      return db.raw(`
CREATE FUNCTION entries_search_trigger() RETURNS trigger AS $$
begin
  new.tsv :=
    setweight(to_tsvector(new.name), 'A') ||
    setweight(to_tsvector(coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector(coalesce(new.homepage, '')), 'D');
  return new;
end
$$ LANGUAGE plpgsql
`)
    })
    .then(() => {
      return db.raw(`
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON entries FOR EACH ROW EXECUTE PROCEDURE entries_search_trigger()
`)
    })
})

export const down = unthenify(function () {
  return db.raw('ALTER TABLE entries DROP COLUMN IF EXISTS tsv')
    .then(() => db.raw('DROP TRIGGER tsvectorupdate ON entries'))
    .then(() => db.raw('DROP FUNCTION entries_search_trigger()'))
})
