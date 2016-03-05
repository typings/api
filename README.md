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
* **ambient** Search ambient module sources (default: `null`, boolean)

### /entries/:source/:name

> Print version details from the registry.

* **source** The source to use (from `/search`)
* **name** The name of the project (from `/search`)

#### /versions/:range?

> Find all versions, or versions matching a range.

* **version** A semantic version query (default: `*`)

##### /latest

> Get the latest version matching the semver range.

### /tags/:tag

> Select a particular tag from the registry.

* **tag** The semver tag for the version

## Development

Requires Redis and Postgres.

```sh
git clone
npm install

npm run build-watch
npm run start-watch
```

### Environment

```sh
export DATABASE_URL="postgres://admin:admin@localhost:5432/typings_registry"
export REDIS_URL="redis://localhost:6379"
export QUEUE_UI_USERNAME="admin"
export QUEUE_UI_PASSWORD="admin"

export NEW_RELIC_ENABLED=false
export NEW_RELIC_NO_CONFIG_FILE=true

export UA_ID=""
```

## License

Apache 2.0
