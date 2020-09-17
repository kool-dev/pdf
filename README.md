# PDF microservice

This is a work in progress for a PDF generation micro-service.

## Getting started using this microservice in your project

If you use Docker Compose (hopefully with [`kool`](https://github.com/kool-dev/kool) to make things simpler) you can get PDF generation on your project with a few simple steps:

- Add the service to your `docker-compose.yml` file:

```yml
  pdf:
    image: "kooldev/pdf:latest"
    expose:
      - 3000
```

- After starting the service containers (with either `kool start` or `docker-compose up -d`), you can already start using the microservice to make PDFs! Example using PHP:

```php
use GuzzleHttp\Client;

$pdf = (new Client())->post('http://pdf_dev/from-html', [
    'form_params' => [
        'html' => '<h1>This is my super kool HTML that I want to turn into an awesome PDF file!</h1> <p> This is a very silly example, but you get the idea of how powerful this is <b>:)</b> </p>',
        'options' => json_encode([
            'format' => 'A4',
            'printBackground' => false,
        ]),
    ],
])->getBody();

file_put_contents('path/to/my/super-kool.pdf', $pdf);
```

* Important to notice, the code above assumes you are running it from within another container in the same Docker Compose application so the `pdf` domain resolves to our microservice.

* The `options` should be a json data type

* You can see all these `options` in [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#pagepdfoptions)

## Getting started on developing locally this microservice

To get started with development locally (using [`kool`](https://github.com/kool-dev/kool), of course!):

- Fork the repo.
- Clone the fork.
- `kool run yarn install` - this will install dependencies.
- `kool start` - will get up the API on localhost:3000.
- `docker-compose logs -f` - tails the API logs.

In order to manage dependencies and run commands, please remind of using `kool run yarn` to stick with one single yarn version.

## Roadmap

Soon to be added wishes:

- Parameters to better control Javascript execution/wait condition.
- Conversion to images also.
- Got some _kool_ feature you are not seeing? Please open a ticket to suggest it!

## API

The API will provide endpoints for generating PDFs on the fly and returning them right away.

#### From an URL

Endpoint: `GET /from-url?url=`

Parameters:
 - `url`: URL of the page we want to convert to PDF.

Returns the rendered PDF from the provided URL, or a JSON with an error message and status.

#### Health status

Endpoint: `GET /health`

Returns the current status in JSON. Status code may be 200 (active) or 503 (not ready).
