# PDF microservice

This is a work in progress for a PDF generation micro-service.

## Getting started
To get started with development locally (using [`kool`](https://github.com/kool-dev/kool), of course!):

- Fork the repo.
- Clone the fork.
- `kool run setup-local` - this will build the local image and install dependencies.
- `kool start` - will get up the API on localhost:3000.
- `docker-compose logs -f` - tails the API logs.

In order to manage dependencies and run commands, please remind of using `kool run yarn` to stick with one single yarn version.

## API

The API will provide endpoints for generating PDFs on the fly and returning them right away.

#### From an URL

Endpoint: `/from-url?url=<URL of the page we want to convert to PDF>`
