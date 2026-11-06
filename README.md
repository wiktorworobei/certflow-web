# CertFlow Web

Responsive CertFlow frontend with six visual themes and light/dark modes.

Production: https://wiktorworobei.github.io/certflow-web/

The GitHub Pages workflow builds `frontend/` with the repository variable `VITE_API_BASE_URL` (HTTPS API URL ending in `/api`). No server secrets belong in this repository.

Local development: `cd frontend`, `npm ci`, `npm run dev`. For a production build run `npm run build`. Authentication and application data are provided by the separately deployed CertFlow API.
