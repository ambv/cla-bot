# cla-bot

A GitHub bot and Web UI for managing contributor license agreements.

## THIS IS NO LONGER USED
See [https://github.com/psf/clabot](https://github.com/psf/clabot) for
the Django-based replacement.

## Installation

This instance is forked from the original and ran by the
Python Software Foundation for
[python/cpython](https://github.com/python/cpython/).

It's deployed on Heroku via https://git.heroku.com/cpython-clabot.git
with configuration stored in [heroku.yml](./heroku.yml).

The default Dockerfile here includes the frontend CLA bot Web app and
is the same as the upstream CLA bot.  Since it's AWS-specific, we use
a separate file: Dockerfile.cpython.  This one includes both EdgeDB
Server *and* the CLA bot Web app. This is because Heroku doesn't support
network linking of Docker images, and the only network protocol exposed
for EdgeDB would be HTTPS which is insufficient for our needs.

Since EdgeDB here is backed by a Postgres instance, there can be
multiple frontend EdgeDB server processes without an issue.

Note that Dockerfile.cpython only includes files from the upstream
CLA bot Web frontend image hosted on `hub.docker.com` instead of
building the files inline.  This is because the upstream build uses
`COPY . .` which invalidates on any non-ignored file change in this
repository. And the Yarn Next.js build takes over 5 minutes.

## Maintenance

When upgrading CLA bot frontend code, rebuild ``ambv/cla-bot-frontend``
by running:

```
docker build -t ambv/cla-bot-frontend .
docker push ambv/cla-bot-frontend
```

This is a helper image that is merged with the EdgeDB server later
using `Dockerfile.cpython`. That main image is built by Heroku itself
when you push to the Heroku git from this repo.
You can also rebuild ``ambc/cla-bot-cpython`` manually by running:

```
docker build -t ambv/cla-bot-cpython . -f Dockerfile.cpython
```

You can run a local container and use it in a regular fashion granted
that there's an `.env` file with `DATABASE_URL` in it from Heroku
Postgres.  You can read it by running `heroku config`.  Once the file
is there, start the container with:

```
docker run -it --rm --name cla-bot --env-file .env -p 3000:3000 -p 5656:5656 ambv/cla-bot-cpython
```

## Running a deploy on Heroku

```
$ git clone $THIS_REPO
$ heroku git:remote -a cpython-clabot
$ git push heroku cpython-clabot:main
```

This will output build information during the push.

---

What follows is the original README.

---

## Development

**Requirements:**

- Node.js v13.3.0
- yarn (install with `npm install -g yarn`)

A full setup requires also:

- a configured OAuth application in GitHub
- a configured GitHub application in GitHub
- an EdgeDB instance configured with schema from `dbschema/`
- `.env` file populated with proper application settings
- a web hook for pull requests

For more information on this first-time configuration, refer to the
documentation in the project Wiki, at
[Configuration](https://github.com/edgedb/cla-bot/wiki/Configuration).

### Getting started:

```bash
# install dependencies
yarn install

# run the development server
yarn next
```

## Project structure

This project uses onion architecture, with the following namespaces:

- `constants` contains configuration constants
- `components` contains reusable React components
- `pages` is a folder handled by `Next.js`, with routes: pages and api
- `pages-common` is a folder containing common code for pages and api used in
  `Next.js` front-end
- `public` is a folder handled by `Next.js`, containing static files
- `service.domain` contains domain objects and interfaces for external services
- `service.data` contains concrete implementations of external services
- `service.handlers` contains business logic

Business logic is lousy coupled with the data access layer, since it is only
aware of interfaces, not concrete implementations of DAL logic. Everything
inside the `service` folder is abstracted from `Next.js` and should be
reusable with other web frameworks, unmodified.

## Documentation

For documentation, refer to the [project Wiki](https://github.com/edgedb/cla-bot/wiki).
