### production Dockerfile for frontend (build static files and serve with nginx)
FROM node:24.11.0-alpine3.21 AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.20.0
RUN pnpm install
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY index.html ./
RUN pnpm run build

FROM nginx:1.27.4-alpine3.21 AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
