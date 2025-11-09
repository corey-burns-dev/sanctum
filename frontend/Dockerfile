### production Dockerfile for frontend (build static files and serve with nginx)
FROM node:24.11.0-alpine3.21 AS build
WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
  mv ~/.bun/bin/bun /usr/local/bin/ && \
  mv ~/.bun/bin/bunx /usr/local/bin/

COPY package.json bun.lockb* ./
RUN bun install
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY index.html ./
RUN bun --bun run build

FROM nginx:1.29.3-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
