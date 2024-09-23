FROM node:22-alpine3.19

RUN mkdir /app && chown -R node:node /app
WORKDIR /app
USER node
COPY --chown=node:node . /app
RUN npm ci --only=production && npm cache clean --force
CMD ["node", "src/index.js"]