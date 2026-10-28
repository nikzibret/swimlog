# swimlog

A swim tracking app for the pool, built as a mobile-first PWA that can be added to the iOS home screen.

## What it does

- Log sessions and sets with stroke type, laps, equipment and rest periods
- Wall-clock timing: set and rest times cascade forward from the start, with manual overrides
- Calorie estimates based on MET values, plus weight tracking
- Personal records board and pace charts
- Scrollable calendar with session type indicators
- Repeat or copy a previous session
- Shareable square session card, exported as a PNG
- Email and password sign-in

One lap is counted as 50 m (there and back in a 25 m pool).

## Stack

- React and TypeScript, built with Lovable
- Supabase for Postgres, auth and row-level security
- PWA manifest for home screen install

## Status

Personal project in active development. The source is not published yet: it is being cleaned of personal data and credentials first.

Planned: Spotify integration, Oura Ring HRV overlay, and Apple Health via Capacitor.
