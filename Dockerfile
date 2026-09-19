FROM node:24-alpine AS frontend
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm test && npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY --from=frontend /src/web/dist ./web/dist
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /pane .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -g 10001 pane && adduser -D -u 10001 -G pane pane && mkdir /config && chown pane:pane /config
COPY --from=backend /pane /usr/local/bin/pane
USER 10001:10001
EXPOSE 8080
VOLUME ["/config"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/usr/local/bin/pane"]
