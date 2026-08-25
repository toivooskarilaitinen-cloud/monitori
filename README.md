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

- ATTENTION: normalised concentration (HHI) of traffic estimates in Google Trends Trending Now RSS.
- KNOWLEDGE: all English Wikipedia edits and new pages in the preceding hour; MediaWiki continuation is followed to completion.
- EVENTS: record count in the latest 15-minute GDELT 2.0 GKG archive.
- ACTIVITY: Cloudflare Radar relative HTTP activity, compared with preceding days at the same UTC hour. It is not presented as a raw global request count. Requires `CLOUDFLARE_API_TOKEN`.
- DISCUSSION: posting-rate signals from Hacker News, Mastodon public timelines, and Bluesky Jetstream. Every network receives its own robust baseline and z-score before the scores are combined.

Method v0.3 uses hourly observations. Baselines prefer the same weekday and UTC hour, then fall back to the same hour. OUTOUS is current absolute deviation; VAIHTELU is the 24-hour change in sensor z-scores.

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
