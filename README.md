# VAIMEA LAB / MONITORI

MONITORI is an experimental observatory for the state of the open internet.

Core sensors:
1. Google Trends — ATTENTION
2. Wikipedia — KNOWLEDGE
3. News volume — EVENTS
4. Internet traffic — ACTIVITY
5. Conversation — DISCUSSION

Derived signals:
- ACTIVITY
- VOLATILITY
- ATTENTION
- TENSION
- CURIOSITY
- STRANGENESS
- CONDITIONS

## Data philosophy

MONITORI does not claim to measure the whole internet. It records a small, explicit set of signals from the open internet.

Raw observations are preserved. Daily snapshots include a methodology version so historical readings can later be recalculated without overwriting the original result.

## Current source adapters

- ATTENTION: Google Trends Trending Now RSS fallback. The official Google Trends API is still limited-access alpha, so the collector is designed to accept an official API adapter later.
- KNOWLEDGE: Wikimedia / Wikipedia public API.
- EVENTS: GDELT 2.0 `lastupdate.txt` metadata, using the current GKG archive size as a lightweight volume proxy.
- ACTIVITY: Cloudflare Radar API. Requires `CLOUDFLARE_API_TOKEN`.
- DISCUSSION: a composite posting-rate signal from Hacker News, Mastodon public timelines, and the Bluesky Jetstream. Each source is measured separately before the available rates are combined, so a single network does not define the whole category.

## GitHub secret

Create a repository secret:

`CLOUDFLARE_API_TOKEN`

The token only needs read access to Cloudflare Radar.

## Collection

GitHub Actions runs the collector four times per day and commits observations back to the repository.

Observations:
`data/observations/YYYY-MM-DDTHH.json`

Daily snapshot:
`data/history/YYYY-MM-DD.json`

Latest:
`data/latest.json`

The first 30 days are primarily baseline collection. Scores are marked provisional until enough history exists.

## Local run

```bash
python -m pip install -r requirements.txt
python scripts/collect.py
```
