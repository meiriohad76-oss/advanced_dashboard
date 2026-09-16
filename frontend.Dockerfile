FROM node:22.11.0-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM nginx:1.27.3-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/healthz || exit 1
