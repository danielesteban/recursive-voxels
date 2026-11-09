FROM node:lithium

RUN mkdir -p /usr/src/server
WORKDIR /usr/src/server

ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest-12 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY dist dist

USER node

ENV PORT 80
EXPOSE 80
CMD ["node", "dist/main.js"]
