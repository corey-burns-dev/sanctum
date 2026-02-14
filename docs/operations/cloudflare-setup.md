# Cloudflare Setup & DNS Propagation Guide

This guide covers the end-to-end setup for Sanctum's edge infrastructure using Cloudflare, including DNS management, SSL/TLS configuration, and secure origin connectivity via Cloudflare Tunnels (Argo).

---

## ☁️ 1. Domain & DNS Setup

### Initial Nameserver Pointing
1. Log in to your domain registrar (e.g., Namecheap, Google Domains).
2. Change the Custom Nameservers to the ones provided by Cloudflare:
   - `dash.cloudflare.com` -> Add Site -> Follow instructions.
   - Typically: `dexter.ns.cloudflare.com` and `heather.ns.cloudflare.com`.

### DNS Propagation Check
Propagation can take anywhere from 5 minutes to 24 hours.
- **Tools:** Use [DNSChecker.org](https://dnschecker.org) to verify your records globally.
- **Records to Create:**
  - `A` record for root domain (e.g., `sanctum.dev`) pointing to your server IP.
  - `CNAME` for `www` pointing to root.
  - `CNAME` for `api` if using a separate subdomain.

---

## 🔒 2. SSL/TLS Configuration

Sanctum requires end-to-end encryption.

1. **SSL/TLS Mode:** Set to **Full (Strict)**.
   - This ensures Cloudflare verifies the certificate on your server.
2. **Edge Certificates:**
   - Enable **Always Use HTTPS**.
   - Enable **Minimum TLS Version: 1.2**.
   - Enable **HSTS** (HTTP Strict Transport Security) for 6 months once stable.

---

## 🚇 3. Cloudflare Tunnels (Recommended)

Tunnels allow you to expose your local or private production server to the internet without opening any ports (no port forwarding required).

### Local Setup (Development/Test)
The `compose.local.yml` includes a `cloudflared` service.

1. **Authenticate:**
   ```bash
   docker run --rm -v $(pwd)/data/cloudflared:/etc/cloudflared cloudflare/cloudflared:latest tunnel login
   ```
2. **Create Tunnel:**
   ```bash
   docker run --rm -v $(pwd)/data/cloudflared:/etc/cloudflared cloudflare/cloudflared:latest tunnel create sanctum-tunnel
   ```
3. **Route Traffic:**
   Map your domain to the tunnel:
   ```bash
   docker run --rm -v $(pwd)/data/cloudflared:/etc/cloudflared cloudflare/cloudflared:latest tunnel route dns sanctum-tunnel sanctum.dev
   ```

### Production Setup
For production, use the `/mnt/storage/Sanctum/prod/cloudflared` directory as configured in your volumes.

---

## ⚡ 4. Speed & Performance

### Caching Rules
Sanctum's API and WebSockets require specific bypasses.
- **Bypass Cache for API:** Create a Page Rule for `sanctum.dev/api/*` -> **Cache Level: Bypass**.
- **WebSocket Support:** Ensure **WebSockets** is toggled **ON** in the Network settings.

### Polish & Minification
- **Brotli:** Enable for better compression.
- **Auto Minify:** Disable for JavaScript (Vite already handles this) to avoid double-processing.

---

## 🛡️ 5. Security Hardening

### WAF (Web Application Firewall)
Add a "Free Tier" WAF rule:
- **Block Known Botnets:** Use Cloudflare's managed rules.
- **Rate Limiting:** Set a rule to challenge (JS Challenge) IPs making more than 100 requests per minute to `/api/auth/*`.

### Scrapers & Crawlers
- Enable **Bot Fight Mode** to prevent AI scrapers from hitting your feed endpoints.

---

## 🛠️ Troubleshooting

### "Invalid SSL Certificate" (Error 526)
- **Cause:** Your server's certificate is expired or self-signed while in "Full (Strict)" mode.
- **Fix:** Use Cloudflare Origin CA certificates or Let's Encrypt.

### WebSocket Connection Drops
- **Cause:** Cloudflare has a 100-second idle timeout for WebSockets.
- **Fix:** Ensure the Sanctum backend sends heartbeats/pings at least every 30-60 seconds.

### Tunnel Not Starting
- **Check Logs:**
  ```bash
  docker compose logs -f cloudflared
  ```
- **Common Issue:** Permissions on the credentials JSON file. Ensure the `cloudflared` user in the container can read `/etc/cloudflared/cert.pem`.

---

## 📚 Related Documentation
- **Production Readiness:** [production-readiness.md](production-readiness.md)
- **Deployment Plan:** [plans/fix-deploy.md](../plans/fix-deploy.md)
