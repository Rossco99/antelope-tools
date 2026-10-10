# Production image: the dashboard built for one network, served by nginx.
# `make prod-up` writes .env.build (that network's REACT_APP_* settings).
FROM node:24-bookworm-slim AS build-stage
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY ./ ./
# vite.config.js reads ../.env
RUN cp .env.build ../.env && yarn build

FROM nginx:1.30.5-alpine AS run-stage
COPY --from=build-stage /usr/src/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY compression.conf /etc/nginx/conf.d/compression.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
