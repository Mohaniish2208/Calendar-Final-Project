# Google Calendar Clone (Final Project)

A simplified Google Calendar clone built with React + TypeScript + Vite.

## Features

- Monthly calendar view with `Today`, previous month, and next month navigation
- Day cells with in-month and out-of-month styling
- Add event modal with:
  - `name` (required)
  - `allDay` checkbox
  - `startTime` / `endTime` (for timed events)
  - `color` selection (`red`, `green`, `blue`)
- Edit existing events
- Delete existing events
- Event ordering:
  - all-day events first
  - timed events sorted by start time
- Overflow handling with `+X more` modal
- Events persisted in `localStorage`
- Modal open/close animations

## Tech Stack

- React
- TypeScript
- Vite
- HTML
- CSS

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm 9+

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Then open the local URL shown in terminal (usually `http://localhost:5173`).

### Build for Production

```bash
npm run build
```

## Project Structure

```txt
.
- public/
- src/
  - components/
    - Calendar/
  - styles/
  - types/
  - utils/
- index.html
- package.json
- vite.config.ts
```

## Data Persistence

- Events are stored in browser `localStorage`
- Storage key: `calendar_events_v1`

## Deployment / Sharing

- Push to GitHub
- Import the repository into CodeSandbox from GitHub

## Notes

- This project is a learning implementation and not connected to Google Calendar APIs.

## Author

- [@Mohaniish2208] ([Github](https://www.frontendmentor.io/profile/Mohaniish2208))
