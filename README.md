# HomePro

HomePro is a full-stack home services platform with an Angular frontend and an Express/MongoDB backend.

## Overview

The project is split into two applications:
- **client/**: Angular web application for end users.
- **server/**: Node.js + Express API with MongoDB persistence and JWT-based authentication.

## Project Structure

```text
homepro/
├── client/   # Angular frontend
└── server/   # Express backend
```

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB running locally or a valid MongoDB connection string

## Setup

### 1) Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 2) Configure environment variables (server)

Create a `.env` file in `server/` (or copy from `.env.example`) and set at least:

- `PORT`
- `CLIENT_URL`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

## Run

### Start backend (server)

```bash
cd server
node server.js
```

(Alternative for development)

```bash
cd server
npx nodemon server.js
```

### Start frontend (client)

```bash
cd client
npm start
```

Frontend default URL: `http://localhost:4200`

## License

This repository is intended for public source distribution.
