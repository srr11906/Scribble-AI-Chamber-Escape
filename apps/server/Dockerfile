FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm run build --workspace=apps/server

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["npm", "start", "--workspace=apps/server"]
