# halfurness.com

Personal project hub hosted via GitHub Pages.

## Projects

- **[Bakify](/bakify/)** — Web viewer for Bakify recipes

## Structure

```
index.html      Hub homepage
hub.css         Homepage styles
bakify/         Bakify web app
  index.html
  app.js
  styles.css
  icon.png
```

## Adding a new project

1. Create a new directory (e.g., `my-project/`)
2. Add an `index.html` and any assets inside it
3. Add a project card to the root `index.html`

## Bakify Setup

### OAuth Client

In Google Cloud Console (same project as the Android app):

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**
4. Name: "Bakify Web"
5. Add Authorized JavaScript origins:
   - `https://halfurness.com`
   - `http://localhost:8000` (for local testing)
6. Copy the **Client ID** into `bakify/app.js`

### Local Testing

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```
