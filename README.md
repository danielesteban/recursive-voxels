[recursive-voxels](https://recursive-voxels.gatunes.com)
==

#### Local development

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
