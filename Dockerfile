FROM node:23-alpine AS base
WORKDIR /app

FROM base AS build
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM base
COPY --from=build /app/dist dist
CMD [ "node", "dist/index.js" ]
