# Deploy

The app is static (`npm run build` → `dist/`). It needs HTTPS for the iPhone install and offline mode. Pick one host.

## GitHub Pages (workflow included)
1. Create a GitHub repo (it can be private if your plan allows Pages on private repos) and push this folder to `main`:
   ```sh
   git init && git add . && git commit -m "Via Ferrata app"
   git branch -M main && git remote add origin git@github.com:<you>/<repo>.git && git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml` (checks → build → publish).
   The app goes live at `https://<you>.github.io/<repo>/`.

## Cloudflare Pages (alternative)
Dashboard → **Workers & Pages → Create → Pages → Connect to Git**, pick the repo, then:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `NODE_VERSION=22`

It deploys to `https://<project>.pages.dev/` (served from `/`, so no `BASE_PATH` is needed).

## Install on iPhone
Open the URL in **Safari** → Share → **Add to Home Screen**. Launch it from the icon so it runs full-screen.
Your data lives in that installed app's storage, which is separate from the Safari tab's. Export a backup from
Settings now and then.
