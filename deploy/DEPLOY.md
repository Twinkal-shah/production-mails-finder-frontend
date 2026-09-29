# Deploying the frontend to Hetzner

Moves `app.mailsfinder.com` off Vercel onto our own server.

**Use a separate server from the backend.** The backend does email finding and
verification — lots of DNS lookups, SMTP connections and concurrency. If Next.js
shares that box, the two compete for CPU during traffic spikes and both get slow.
A small Hetzner Cloud instance (CX22 class, 2 vCPU / 4 GB) is plenty for the
frontend. Put it in the **same region** as the backend so they talk over the
private network.

The Vercel deployment stays live the whole way through. Nothing is switched until
step 7, and step 8 is how to undo it.

---

## 1. Server prep

```bash
ssh root@<new-server-ip>

apt update && apt upgrade -y
apt install -y ca-certificates curl git nginx

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Firewall: only SSH + HTTP(S) from outside. The app port stays on loopback.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. Get the code

```bash
mkdir -p /opt/mailsfinder && cd /opt/mailsfinder
git clone <repo-url> frontend
cd frontend
```

## 3. Environment file

```bash
cp .env.example .env
nano .env          # fill in real values
chmod 600 .env
```

Copy the values straight out of the Vercel project settings
(Settings → Environment Variables) so nothing drifts.

> `NEXT_PUBLIC_*` values get **baked into the JavaScript bundle at build time**.
> If you change one later, you must rebuild the image — restarting the container
> is not enough. Everything else (`SUPABASE_SERVICE_ROLE_KEY`, the
> `LEMONSQUEEZY_*` keys) is read at runtime and never reaches the browser.

## 4. Build and start

```bash
docker compose up -d --build
docker compose logs -f          # ctrl-c once it says "Ready"
curl -s localhost:3000/api/health
# -> {"status":"ok","uptime":...}
```

## 5. nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/app.mailsfinder.com
ln -sf /etc/nginx/sites-available/app.mailsfinder.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

## 6. Cloudflare + SSL

Our users are mostly US and the server is in the EU, so Cloudflare's CDN is doing
real work here — it isn't optional.

1. In Cloudflare DNS, add an `A` record for `app` → new server IP, proxy **on**
   (orange cloud). Leave the Vercel record alone until step 7.
2. SSL/TLS mode: **Full (strict)**.
3. Generate the Cloudflare IP list nginx needs for real visitor IPs:

```bash
{ for ip in $(curl -s https://www.cloudflare.com/ips-v4) \
             $(curl -s https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done; } > /etc/nginx/cloudflare-ips.conf
```

4. Issue the certificate:

```bash
apt install -y certbot python3-certbot-nginx
mkdir -p /var/www/certbot
certbot --nginx -d app.mailsfinder.com
nginx -t && systemctl reload nginx
```

Certbot installs its own renewal timer. Confirm with `systemctl list-timers | grep certbot`.

## 7. Cutover

Test the server directly before sending anyone to it:

```bash
curl -sI https://app.mailsfinder.com --resolve app.mailsfinder.com:443:<new-server-ip>
```

Then in a browser, with the host pointed at the new IP, check by hand:

- [ ] Log in (email/password **and** Continue with Google)
- [ ] Single find + single verify return results
- [ ] Bulk upload a CSV — this is the one that breaks if `client_max_body_size` is wrong
- [ ] Download a bulk result CSV
- [ ] Credits display and update
- [ ] `/appsumo/activate` page loads
- [ ] LemonSqueezy checkout opens

Only when all of those pass: point the DNS record at the new server and remove the
Vercel record. Keep the Vercel project deployed (not deleted) for about a week.

**Also update the redirect/callback URLs** for Google OAuth and Supabase Auth, and
the LemonSqueezy webhook URL, if any of them point at a `*.vercel.app` domain
rather than `app.mailsfinder.com`.

## 8. Rollback

Point DNS back at Vercel. That's it — the Vercel deployment was never touched.

## 9. Redeploys

```bash
cd /opt/mailsfinder/frontend && ./deploy/deploy.sh
```

---

## Notes

- The container listens on `127.0.0.1:3000` only. It is not reachable from the
  internet except through nginx.
- Docker logs are capped at 10 MB × 5 files so they can't fill the disk.
- Worth adding once this is live: an uptime check hitting
  `https://app.mailsfinder.com/api/health`, and automated backups on the droplet.
