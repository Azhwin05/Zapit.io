# Master Prompt — Pre-Deployment Readiness Report (paste into Claude Code)

```
Produce a Pre-Deployment Readiness Report for this project. This report will be reviewed
by an independent reviewer (not you) to decide whether this is safe to deploy publicly,
so it must be evidence-based, not optimistic. Do not mark anything as PASS unless you have
actually verified it — by reading the actual implementation, tracing the actual logic, or
running an actual test. If you have not verified something, mark it NOT VERIFIED, not PASS.
A report full of unearned PASS marks is worse than an honest report with gaps, because it
creates false confidence right before a public launch.

=== PART 1: CONFIRM PRIOR FINDINGS ARE ACTUALLY FIXED ===

If a security audit and/or workflow reliability audit was previously run on this codebase,
go through every Critical and High severity finding from those reports and verify, with
specific evidence (file/line reference, and how you confirmed it), whether each one has
been:
- FIXED AND VERIFIED (explain exactly how you confirmed the fix actually works, not just
  that code was changed)
- FIXED BUT NOT YET VERIFIED (code changed, but not actually tested/traced end to end)
- NOT FIXED
- NO LONGER APPLICABLE (explain why)

=== PART 2: GO-LIVE CHECKLIST ===

Work through every item below. For each: PASS / FAIL / NOT VERIFIED, with evidence.

SECURITY
- [ ] Room codes are cryptographically random with sufficient keyspace to resist
      brute-force within their lifetime
- [ ] Room code lookups are rate-limited server-side
- [ ] End-to-end encryption (if implemented) uses a unique IV/nonce per chunk, never reused
- [ ] No secrets, API keys, or TURN credentials exist in client-side bundles or git history
- [ ] TURN credentials are short-lived and scoped per-session, not static
- [ ] All user-controlled input (filenames, text, room codes) is properly escaped before
      rendering — no XSS vector
- [ ] Security headers are set: CSP, X-Frame-Options, X-Content-Type-Options, HSTS
- [ ] Dependency vulnerability scan has been run, with zero unresolved Critical/High CVEs
- [ ] Server validates and gracefully rejects malformed/oversized signaling messages
      instead of crashing
- [ ] There is a cap on concurrent connections/rooms per IP to limit abuse/DoS

RELIABILITY (must map back to the workflow audit's state machine)
- [ ] Every async operation has explicit error handling — no empty catch blocks, no
      unhandled promise rejections anywhere in the transfer or signaling flow
- [ ] ICE candidates arriving before the remote description is set are queued, not dropped
- [ ] Negotiation glare (both peers offering simultaneously) is handled deterministically
- [ ] Data channel backpressure (bufferedAmountLow) is respected — verified under a large
      file transfer, not just present in code
- [ ] Chunk-level retry on checksum failure has been tested with an actual induced failure,
      not just implemented and assumed correct
- [ ] Resume-after-disconnect has been tested with an actual simulated network drop
      mid-transfer, confirming no data corruption and no restart-from-zero
- [ ] Final/boundary chunk handling tested with file sizes that are NOT a clean multiple
      of the chunk size
- [ ] Navigation/redirect logic after async events has been traced for race conditions
      against component unmount and stale closure state
- [ ] Tested on Chrome desktop, Safari desktop, Chrome Android, Safari iOS, Firefox desktop
      — differences noted
- [ ] Tested under throttled/slow network conditions, not only fast WiFi
- [ ] Tested with sender and receiver on different networks, and with one on mobile data
- [ ] All failure states are visibly surfaced to the user — no silent failures where the UI
      looks the same for "working slowly" and "actually failed"

PERFORMANCE & SCALE
- [ ] Memory usage on the receiving end stays flat regardless of file size (verified with
      an actual large file, not assumed from code structure)
- [ ] No memory leaks across repeated transfer sessions (peer connections/listeners
      properly cleaned up — verified by running multiple sequential transfers and checking
      memory does not climb)
- [ ] Signaling server tested under concurrent load (multiple simultaneous rooms) without
      degradation or crash

OPERATIONAL READINESS
- [ ] Structured logging exists for every major state transition and failure point, so a
      future "sometimes it doesn't work" report is actually diagnosable from logs
- [ ] Environment variables/secrets are properly separated between dev and production,
      with nothing sensitive committed to the repository
- [ ] There's a clear, tested rollback plan if a deployment introduces a regression
- [ ] Privacy claims made to users (e.g. "nothing is stored," "end-to-end encrypted")
      have been cross-checked against actual code behavior and are accurate

=== PART 3: HONEST RISK SUMMARY ===

- List anything marked NOT VERIFIED or FAIL, with the actual risk it poses if deployed
  as-is.
- State plainly whether, in your own assessment, this is ready for public deployment,
  ready for a limited/soft launch only, or not yet ready — and why. Do not default to a
  reassuring answer; an honest "not yet ready" is far more useful than false confidence.
- List the specific remaining steps required to close every NOT VERIFIED/FAIL item.

=== OUTPUT FORMAT ===

Output this as a single structured markdown report with all checklist items, their
PASS/FAIL/NOT VERIFIED status, evidence for each, the Part 1 prior-findings confirmation,
and the Part 3 honest risk summary. This exact report is what will be sent to an
independent reviewer for a deployment decision — completeness and honesty matter more
than making the project look ready.
```

---

### What to do with the output

Once Claude Code runs this and gives you the full report, paste the entire thing back to me. I'll review it the way an independent reviewer actually would:

- Check whether the PASS marks have real evidence behind them, or are just asserted
- Flag any item marked PASS that I think should realistically be NOT VERIFIED based on the evidence given
- Cross-reference Part 1 against the earlier audits to make sure nothing got quietly dropped
- Give you a clear verdict: **ready to deploy**, **ready for a limited/soft launch only**, or **not yet ready**, plus exactly what's still missing if it's not a clean pass

That's the realistic version of a "seal of approval" — a second, independent set of eyes checking the self-report for gaps, rather than a guarantee that doesn't exist for any software.
