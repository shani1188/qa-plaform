# Risk-based test matrix

Tests are tagged by area (`@auth`, `@tasks`, `@api`, `@accessibility`) and case class (`@positive`, `@negative`, `@edge`). Bug-related PRs execute all applicable case classes for the detected area before full regression.

| Area | Positive | Negative / boundary | Authorization / failure | Gate |
|---|---|---|---|---|
| Sign-up | Valid new account and verification callback | Invalid email, password under 10 chars, duplicate account | Expired confirmation link | Browser |
| Login/session | Valid login, logout, protected page | Wrong credentials, empty fields | Expired session redirects without data leak | Browser + API |
| Password recovery | Valid request and reset | Unknown email gets identical response | Expired/reused link rejected | Browser |
| Task creation | Valid title, description, priority and persistence after reload | Empty/121-char title, 1001-char description, invalid enum | Server error leaves form recoverable | Functional + API |
| Task retrieval | Own tasks, status filtering, empty state and persisted state | Invalid filter ignored safely | User cannot read another user’s rows | Functional + API + RLS |
| Task update | Status and field updates | Empty patch, malformed UUID, invalid enum | Cross-user/nonexistent ID returns 404 | API + RLS |
| Task deletion | Confirmation and successful delete | Cancelled deletion, malformed/nonexistent ID | Cross-user delete changes no rows | Functional + API + RLS |
| Accessibility | Public auth pages and private board | Keyboard/focus, labels, landmarks, status announcements | axe WCAG 2 A/AA rules | Accessibility |
| Infrastructure | Healthy Vercel preview | Missing/slow preview, absent report | Forks receive no secrets; privileged reporter validates artifact | Required gate |
| Reporting | One managed comment and new defect | Rerun updates comment and issue | Malformed artifact rejected; AI cannot set status | Platform tests |

## Flaky-test policy

Retries remain zero. A confirmed nondeterministic test may be quarantined only with a linked issue, named owner, reason, and expiry date. Quarantined checks remain visible as skipped and cannot be silently promoted to passing.
