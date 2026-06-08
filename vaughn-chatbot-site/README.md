# Vaughn Bot Website

A small website where people can chat with an AI inspired by Vaughn. It is intentionally labeled as a bot, not the real Vaughn.

## Run It On Your Computer

1. Install Node.js if you do not already have it.
2. Open this folder in a terminal.
3. Set your OpenAI API key:

```powershell
$env:OPENAI_API_KEY="your_api_key_here"
```

4. Start the site:

```powershell
npm start
```

5. Open:

```text
http://localhost:3000
```

## Put It Online

The easiest beginner-friendly hosts for this kind of project are Render, Railway, or Fly.io.

Use these settings:

- Build command: leave blank, or use `npm install`
- Start command: `npm start`
- Environment variable: `OPENAI_API_KEY`
- Optional environment variable: `OPENAI_MODEL`

Do not put your API key inside the public website files. Keep it as a private environment variable on the server.

## Edit Vaughn's Personality

The personality is in `server.mjs` under `VAUGHN_PERSONA`. Change that text to make the bot more accurate over time.

Good upgrades later:

- Add a database for saved conversations.
- Add Vaughn-approved notes and retrieve them during chat.
- Add login if you only want friends to use it.
- Add a visible disclaimer that it is an AI inspired by Vaughn.
