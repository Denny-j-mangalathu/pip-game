# Pip

A black-and-white virtual pet based on Denny J Mangalathu's ARTX character submission.

Feed Pip, give it a pat, play five untimed catches, let it sleep, and plant leaves by finishing up to three personal tasks. Progress stays in your browser. There are no absence penalties. Keyboard controls, smaller screens, and reduced motion are supported.

## Play locally

Install Node.js 22 or newer, then run:

    npm start

Open http://localhost:3000. No dependency installation is required.

## Share a home

Run the Node server and choose Share a home. Create a room and copy its invite to a friend using the same server address. Everyone with the invite can care for that pet and garden. Personal task text stays in each browser. Updates arrive approximately every 2.5 seconds.

The server serializes care updates, checks versions, remembers action IDs, and writes room state atomically to data/rooms.json. Keep that directory on persistent storage. PIP_DATA_DIR changes its location. PORT changes the port. HOST defaults to 127.0.0.1. Set HOST=0.0.0.0 behind an HTTPS reverse proxy to make the server reachable by friends.

Shared rooms use an unguessable invite as a bearer credential. Invite holders have the same permissions. This small prototype supports one server process and up to 1,000 rooms. Account roles, invite rotation, public-server abuse controls, and automated backups would be needed before a broad public multiplayer launch.

## GitHub Pages

The included workflow deploys the public/ folder. In repository Settings, open Pages and select GitHub Actions as the source, then run the workflow. GitHub Pages supports the personal game. Shared homes require the Node server because Pages only serves static files.

## Verification

    npm run check

Artwork is a game-native SVG interpretation of Pip. The original concept artwork was generated with OpenAI image generation. The game was developed with Codex. No third-party JavaScript, tracking, external fonts, or API keys are needed.
