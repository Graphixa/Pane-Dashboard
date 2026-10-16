$env:PANE_CONFIG = "./config/pane.yaml"
# Default listen is 127.0.0.1:8080 (no Windows Firewall prompt). For LAN: $env:PANE_LISTEN = ":8080"
cd web
npm run build
cd ..
# The Go server embeds the frontend from internal/ui/dist; refresh it from the build output.
Remove-Item -Recurse -Force internal/ui/dist -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force web/dist internal/ui/dist
go mod download
go run ./cmd/pane
