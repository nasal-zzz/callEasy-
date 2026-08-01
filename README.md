callEasy

callEasy is a React single-page app that extracts phone numbers from uploaded files (Excel, CSV, PDF, DOCX, text, and images via OCR) and presents them as clickable phone links. Each number has a status dropdown (Connected, Switchoff, No Incoming Calls, No Answered). The project is intended to be deployed as a static site (GitHub Pages).

Quick start

1. Install dependencies:
   npm install

2. Run locally:
   npm run dev

3. Build for production:
   npm run build

Deploy to GitHub Pages

1. Create a GitHub repository (for example: `calleasy`).
2. In package.json set `homepage` to:
   "https://<GITHUB_USERNAME>.github.io/<REPO_NAME>"

   Example:
   "homepage": "https://alice.github.io/calleasy"

3. Add the remote and push:
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<GITHUB_USERNAME>/<REPO_NAME>.git
   git push -u origin main

4. Deploy using the gh-pages script (it will push the built `dist` folder to the gh-pages branch):
   npm run deploy

Notes and limitations

- Clicking a phone number uses a tel: link. On mobile devices this opens the device dialer. Web apps cannot write to a phone's call log; the device records the call history itself.
- OCR (images) uses tesseract.js and may be slower on large images; language is set to English by default.
- The app performs parsing in the browser — no server is used, so parsing happens locally on the user's device.

If you want a server-backed version (store results, provide shared call lists, or integrate calling APIs like Twilio), choose the Full MERN stack option and I can scaffold the backend next.
