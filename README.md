# youtubemixtube

HotAppSummer deploy. Find random or personalize music in a unique way. Datamoshed pixels and algorithms choose your music here.

## Overview
HotAppSummer deploy. Find random or personalize music in a unique way. Datamoshed pixels and algorithms choose your music here.

## Tech Stack
- React
- Vite
- Express
- Netlify (deployed)

## Project Structure
```
youtubemixtube/
  - netlify
  - public
  - src
  (19 files total)
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
```bash
git clone https://github.com/1nc0gn30/youtubemixtube.git
cd youtubemixtube
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Available Scripts
  npm run dev - tsx server.ts
  npm run build - vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
  npm run start - node dist/server.cjs
  npm run preview - vite preview
  npm run clean - rm -rf dist server.js
  npm run lint - tsc --noEmit

## Original README
<details>
<summary>Click to expand original README</summary>

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/85515d12-8259-49ce-a83e-ec1d63dab162

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

</details>

## TODO / Roadmap
- [ ] Add unit tests
- [ ] Add LICENSE file
- [ ] Add Dockerfile for containerized deployment
- [ ] Consider adding Tailwind CSS
- [ ] Add CI/CD pipeline
- [ ] Add contribution guidelines (CONTRIBUTING.md)
- [ ] Improve error handling and edge cases
- [ ] Add environment variable documentation
- [ ] Update dependencies to latest versions
- [ ] Add code comments and inline documentation

## Deployment
This project is deployed on Netlify. See netlify.toml for configuration.

## Author
**Neal Frazier** - [@AshAmplifies](https://github.com/1nc0gn30)

## Links
- GitHub: https://github.com/1nc0gn30/youtubemixtube

---
*This README was enhanced as part of the neals-projects-2026 batch update.*
