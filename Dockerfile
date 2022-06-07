FROM kooldev/puppeteer:1.0

WORKDIR /app
COPY --chown=pptruser:pptruser . /app

ENV NODE_ENV=production

RUN yarn install

CMD ["yarn", "start"]
