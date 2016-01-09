# Typings API

> The TypeScript definition registry.

## Usage

Simple RESTful API for integration with any source.

### /search

Search all known TypeScript definitions.

#### Query Parameters

* **query** The search phrase
* **name** The exact name of the project
* **source** The source to search (`dt`, `npm`, `ambient`, `github`, `bower` or `common`)
* **offset** The offset to search from
* **limit** The maximum number of items to return (max: `50`)
* **ambient** Search ambient module sources (default: `null`, boolean)

### /versions/:source/:name/:version?

Print the details in the registry.

#### URI Parameters

* **source** The source to use (from `/search`)
* **name** The name of the project (from `/search`)
* **version** A semantic version query (default: `*`)

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
```

## License

Apache 2.0
