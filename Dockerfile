FROM node:24-alpine AS frontend
RUN apk add --no-cache ffmpeg
WORKDIR /src
COPY wallpapers ./wallpapers
COPY web/package*.json ./web/
WORKDIR /src/web
RUN npm ci
COPY web/ ./
RUN npm run catalogue && npm test && npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY --from=frontend /src/internal/builtin/data ./internal/builtin/data
COPY --from=frontend /src/web/dist ./internal/ui/dist
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /pane ./cmd/pane

FROM alpine:3.23
RUN apk add --no-cache ca-certificates su-exec \
	&& mkdir /config
COPY --from=backend /pane /usr/local/bin/pane
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV PANE_LISTEN=:7775
EXPOSE 7775
VOLUME ["/config"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O - http://127.0.0.1:7775/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
