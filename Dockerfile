FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# DWDS über Nginx-Proxy (/api/dwds) nutzen, damit im Container kein CORS entsteht
ARG VITE_DWDS_PROXY=/api/dwds
ENV VITE_DWDS_PROXY=$VITE_DWDS_PROXY
RUN npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

RUN apk add --no-cache openssl

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist .

RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout /etc/nginx/certs/server.key \
      -out /etc/nginx/certs/server.crt \
      -days 3650 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

EXPOSE 6000

CMD ["nginx", "-g", "daemon off;"]
