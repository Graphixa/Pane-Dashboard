$env:PANE_CONFIG = "./config/pane.yaml"
# Default listen is 127.0.0.1:8080 (no Windows Firewall prompt). For LAN: $env:PANE_LISTEN = ":8080"
cd web
npm run build
cd ..
go mod download
go run .
