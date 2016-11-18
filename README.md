# Typings API

> The TypeScript definition registry.

## Usage

Simple RESTful API for typings integration. Available at https://api.typings.org/.

### /search

> Search known TypeScript definitions.

#### Query Parameters

* **query** The search phrase
* **name** The exact name of the project
* **source** The source to search (from the [registry](https://github.com/typings/registry#structure) + `dt`)
* **offset** The offset to search from
* **limit** The maximum number of items to return (max: `50`)

### /entries/:source/:name

> Print version details from the registry.

* **source** The source to use (from `/search`)
* **name** The name of the project (from `/search`)

#### /versions

> Get all versions of an entry.

#### /versions/latest

> Get the latest version of an entry.

#### /versions/:version

> Get all versions matching a semver range.

* **version** A semantic version range

##### /latest

> Get the latest version matching a semver range.

#### /tags/:tag

> Get a specific entry version by tag.

* **tag** The tag from the version entry

## Development

Requires Postgres. Run all migration scripts to get started.

```sh
# Clone and install dependencies.
git clone
npm install

# Run all migration scripts.
npm run migrate -- up -a

# Start the build and watch processes.
npm run dev
```

### Environment

```sh
export DATABASE_URL="postgres://admin:admin@localhost:5432/typings_registry"

export NEW_RELIC_ENABLED=false
export NEW_RELIC_NO_CONFIG_FILE=true

export UA_ID=""
```

## License

Apache 2.0
