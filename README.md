# Bakify Web

Web viewer for Bakify recipes. Sign in with Google to view recipes backed up from the Android app.

## Setup

### 1. Create Web OAuth Client

In your Google Cloud Console (same project as the Android app):

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**
4. Name: "Bakify Web"
5. Add Authorized JavaScript origins:
   - `https://halfurness.dev`
   - `http://localhost:8000` (for local testing)
6. Click **Create**
7. Copy the **Client ID**

### 2. Update app.js

Replace the placeholder in `app.js`:

```javascript
const CONFIG = {
    CLIENT_ID: 'your-actual-client-id.apps.googleusercontent.com',
    ...
};
```

### 3. Local Testing

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Features

- Google Sign-In to access Drive backup
- Grid/List view toggle
- Search by title, ingredients, category, tags
- Filter by category
- Full recipe detail view with images
- Share recipes
- Dark mode support (follows system preference)
