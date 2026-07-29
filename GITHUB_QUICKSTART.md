# GitHub Quickstart — Family Health Journal

This folder is ready to push to GitHub as a Vite + React + TypeScript project.

## 1. Install and run locally

```bash
npm install
npm run dev
```

Open the printed URL, usually:

```text
http://localhost:5173/
```

The read-only backup viewer is available at:

```text
http://localhost:5173/viewer.html
```

## 2. Run production checks

```bash
npm run check
```

This runs TypeScript, tests, and production build.

## 3. Build for deployment

```bash
npm run build
npm run preview
```

Preview URLs are usually:

```text
http://localhost:4173/
http://localhost:4173/viewer.html
```

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Family Health Journal initial app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/health-journal.git
git push -u origin main
```

## 5. Deploy

Deploy the generated `dist/` folder to any static host:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

For PWA install/offline testing, deploy over HTTPS, then open on a phone and choose Add to Home Screen.

## Notes

- The app is local-only and stores journal data in the browser/device.
- Connor is the single default demo/test patient.
- `/viewer.html` opens backup files read-only without touching the real local journal.
- Exports support CSV, XLSX, JSON backup, and full photo backup.
- No external font/network requests are required after load.
