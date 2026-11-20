[recursive-voxels](https://recursive-voxels.gatunes.com)
==

#### Local development

 * [MongoDB](https://mongodb.com/try/download/community) >= 9
 * [Node.js](https://nodejs.org/en/download) >= 26
 * [pnpm](https://pnpm.io/installation) >= 12

```bash
# clone this repo
git clone https://github.com/danielesteban/recursive-voxels.git
cd recursive-voxels
# build network protocol
pnpm -C shared install
pnpm -C shared build:protocol
# install server dependencies
pnpm -C server install
# start the dev server:
pnpm -C server dev
# install client dependencies
pnpm -C client install
# start the dev client:
pnpm -C client dev
# open http://localhost:8080/ in your browser
```

#### Production

##### docker compose

```yaml
services:
  client:
    image: ghcr.io/danielesteban/recursive-voxels/client:master
    restart: always
    environment:
     - SERVER=https://recursive-voxels.example.com/server/
    ports:
     - "127.0.0.1:8080:80"
  server:
    image: ghcr.io/danielesteban/recursive-voxels/server:master
    restart: always
    environment:
     - ALLOWED_ORIGINS=https://recursive-voxels.example.com
     - MONGO_URI=mongodb://mongo/recursive-voxels
    ports:
     - "127.0.0.1:8081:80"
  mongo:
    image: mongo:9
    restart: always
    volumes:
     - "./volumes/config:/data/configdb"
     - "./volumes/data:/data/db"
```

##### nginx proxy

```nginx
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name recursive-voxels.example.com;
  ssl_certificate /etc/letsencrypt/live/recursive-voxels.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/recursive-voxels.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }

  location = /server {
    return 301 /server/;
  }

  location /server/ {
    proxy_pass http://127.0.0.1:8081/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```
