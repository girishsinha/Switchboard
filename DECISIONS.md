# Decisions

## What I built

Status (update before submitting; keep only what is true):

- [ ] Server structure: thin routes, logic in services, readiness-aware /healthz
- [ ] Grader endpoints (reset, snapshot, reply, claim)
- [ ] Pigeon webhook: signature check, deduplication, ordering
- [ ] Replies: stored first, sent by a worker, retried safely
- [ ] Claim: one atomic database update
- [ ] Login (OIDC + PKCE), /api/me, /api/conversations
- [ ] WebSocket with seq numbers and replay (?after=)
- [ ] Several copies of the server (leases, shared rate limit)
- [ ] React frontend

## Main design choices

Pigeon is unreliable on purpose, so each choice answers one of its behaviours.

1. **Duplicate webhooks.** Pigeon delivers at least once and sends deliberate
   duplicates. Messages have a unique index on (workspace, message_id), so the
   database rejects the second copy. A check in code would race when two copies
   arrive at once.
2. **Out-of-order webhooks.** Messages are ordered by the payload's
   `occurred_at`, with `message_id` as the tie-break, never by arrival time.
   Status updates only move forward (queued < sent < delivered/failed), so a
   late "sent" cannot overwrite "delivered".
3. **Forged and replayed webhooks.** The HMAC-SHA256 signature is checked on the
   raw request body with a constant-time compare. Bad or missing signature, or a
   timestamp older than 5 minutes, gives 401. An unparseable body gives 400.
   Unknown event types, unknown workspaces and statuses for messages I never
   sent get 2xx and are ignored, as PIGEON.md requires, so Pigeon stops retrying.
4. **Crashes during a webhook.** I answer 2xx only after the message is stored.
   Every step (store message, update conversation, append event) is idempotent
   and all steps run again for a duplicate, so a crash between steps is repaired
   by Pigeon's retry.
5. **Replies.** A reply is saved first (unique on workspace + client_ref, so the
   same ref twice is one reply and both callers get 202). A separate worker sends
   it to Pigeon with `client_ref` and the same value as `Idempotency-Key`. A
   timeout is treated as "unknown", not "failed", and is retried with the same
   key, so the customer cannot receive it twice and a reply is not lost.
   429 waits for Retry-After; 503 and outages retry with backoff and never
   mark the reply failed.
6. **Claims.** One atomic conditional update (assign only if empty or already
   this agent) on a conversation with a unique (workspace, contact) index. No
   read-then-write, so six simultaneous claimers get exactly one winner.
7. **Real time.** Each workspace has an atomic counter for `seq`. Every frame is
   stored in MongoDB with its seq, so `?after=N` replays from the database.
   Redis pub/sub only tells other copies that something new exists; it is not
   the source of truth.
8. **Several copies.** No state lives in process memory. Send jobs are claimed
   with a short lease (about 30 s), so if a copy dies another picks up its jobs
   well within 60 s. The per-workspace rate limit lives in Redis.

## Assumptions where the brief is silent

- A new inbound message on a closed conversation reopens it.
- Unknown workspace on a reply gives 404; an invalid body gives 400.
- The `agent` in /\_\_grader/claim is an opaque string and is not looked up.
- (add your own)

## What I cut, and why

Two hours was not enough for everything. I cut: [encrypted notes / search /
billing / tests / ...]. I did this because levels 1 to 5 of the check carry most
of the score.

## What I know is still wrong

Be specific and honest. Examples to adapt or delete:

- [e.g. "Level 3: lease takeover not tested with three copies."]
- [e.g. "Frontend has no error handling for a dropped WebSocket."]
- [e.g. "Environment: I developed on Windows/WSL; the check is verified only there."]
