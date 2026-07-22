# TODO: Improve the Adyen Integration Test Tool for Technical Support Agents

This list is prioritized for the primary use case: **technical support agents reproducing and
diagnosing customer integration issues** against Adyen's test environment. Items are grouped by
priority. Each item notes *what*, *why it matters for support*, and *where*.

---

## P0 - Correctness bugs (the tool itself must be trustworthy) - DONE

- [x] **Fix `shipping_methods()` KeyError + undefined `flow`.**
  `if request.json['amount']:` raises `KeyError` when the sessions flow sends `sessionAmount`
  instead of `amount`, and `flow` is only assigned inside that `if`, so it is undefined otherwise.
  Use `.get()` and set `flow` in both branches.
  *File:* `app/app.py` (`shipping_methods`).

- [x] **Fix string identity comparison bug.**
  `if country_code.lower() is not "US".lower():` uses object identity (`is not`) instead of value
  comparison (`!=`). This works by luck today and will silently break shipping-method filtering.
  *File:* `app/app.py` (`shipping_methods`).

- [x] **Wrap all Adyen API calls in error handling and surface the Adyen error body.**
  Implemented via `app/main/errors.py` (`handle_adyen_error`), wired into
  `sessions.py`/`payments.py`/`payment_methods.py`/`payments_details.py` and the inline
  `/orders`, `/paymentMethods/balance`, `/orders/cancel` routes.
  `sessions.py`, `payments.py`, `payment_methods.py`, `payments_details.py`, and the inline
  `orders`/`balance`/`cancel` routes call Adyen with no try/except. On any API error the agent gets
  a Flask 500 stack trace instead of Adyen's `status`/`errorCode`/`message`/`pspReference`, which is
  exactly the information support needs. Catch `Adyen.exceptions.AdyenError`, log it, and return the
  error payload as JSON with the proper status code.
  *Files:* `app/main/*.py`, `app/app.py`.

- [x] **Remove the duplicate, case-colliding template.**
  Removed the incomplete orphan `cardwithStoredCard.html`; kept the referenced `cardWithStoredCard.html`.
  Both `cardWithStoredCard.html` and `cardwithStoredCard.html` exist. On case-insensitive
  filesystems (macOS default) this is ambiguous and error-prone. Keep one.
  *Files:* `app/templates/components/advanced/cardWithStoredCard.html`, `.../cardwithStoredCard.html`.

- [x] **Resolve or remove the dead `checkout_success` GET /sessions logic.**
  Implemented: `/handleShopperRedirect` now detects a Sessions flow return (`sessionId` present
  on the returnUrl) and calls `GET /sessions/{sessionId}` (`adyen_get_session_result` in
  `app/main/sessions.py`) to fetch the final payment outcome, instead of the previous
  Advanced-flow-only `/payments/details` call. The result is flattened onto the existing
  success/failed templates (`resultCode`, `status`, `pspReference`, `merchantReference`).
  *Files:* `app/app.py` (`handle_shopper_redirect`, `_handle_session_redirect`,
  `_flatten_session_result`), `app/main/sessions.py` (`adyen_get_session_result`).

---

## P1 - Configuration centralization (biggest day-to-day usability win)

- [ ] **Create a single source of truth for test parameters.**
  Today amount/currency/country are duplicated and inconsistent:
  `sessions.py` = USD / 10000 / US, `_requestInfo.js` = AUD / 6000 / AU, `cart.html` = EUR / €100.
  Agents must edit multiple files to change one scenario. Consolidate `amount`, `currency`,
  `countryCode`, `shopperReference`, `reference`, and `allowed`/`blockedPaymentMethods` into one
  config (env-driven or a single JS/py config module) consumed by both flows.
  *Files:* `app/main/sessions.py`, `app/static/js/advanced/_requestInfo.js`, `app/templates/cart.html`.

- [ ] **Make the cart total reflect the actual request amount/currency.**
  The cart UI hardcodes €100 while requests use USD/AUD. Drive the displayed total from the same
  config so agents aren't confused about what they are actually charging.
  *File:* `app/templates/cart.html`.

- [ ] **Use a dynamic scheme for `returnUrl` / `origin`.**
  `_requestInfo.js` hardcodes `http://` for `returnUrl`. This breaks redirect and webhook testing
  when the tool is exposed over HTTPS (e.g., ngrok/tunnels), which agents commonly use to receive
  redirects and notifications. Derive scheme from `window.location`.
  *Files:* `app/static/js/advanced/_requestInfo.js`, `app/main/sessions.py`.

---

## P2 - Diagnostics and observability (help agents read what happened)

- [ ] **Replace `print()` with the `logging` module and pretty-print JSON.**
  Backend request/response logging uses bare `print()` while `app.py` uses `logging`. Standardize on
  `logging`, pretty-print request/response bodies, and include `merchantReference` so agents can
  correlate a UI action with its webhook.
  *Files:* `app/main/payments.py`, `payment_methods.py`, `payments_details.py`, `cardDetails.py`.

- [ ] **Render result pages as readable, formatted output.**
  `checkout-success.html` / `checkout-failed.html` dump raw `{{ response }}`. Pretty-print the JSON
  and highlight the fields support cares about: `resultCode`, `pspReference`, `refusalReason`,
  `refusalReasonCode`, and any `additionalData`.
  *Files:* `app/templates/checkout-success.html`, `checkout-failed.html`.

- [ ] **Add a webhook inspection helper.**
  `webhook_notifications()` validates HMAC and then only logs. Add a simple in-memory list + page to
  view recently received notifications (eventCode, success, reason, pspReference), so agents can
  verify end-to-end delivery without tailing the console.
  *File:* `app/app.py` (`webhook_notifications`, `consume_event`).

---

## P2 - Support-agent-facing features

- [ ] **Add an in-app test card / test scenario reference.**
  Agents constantly need Adyen test cards and outcome triggers. Add a panel or page with common
  cards (Visa/Mastercard/Amex), 3DS2 frictionless vs. challenge cards, and refusal-triggering values
  mapped to their `refusalReason`. Removes the need to leave the tool.
  *New file:* e.g. `app/templates/test-cards.html` linked from `home.html`.

- [ ] **Let agents switch Adyen Web SDK and Checkout API versions without editing code.**
  `WEB_VERSION` is hardcoded in `app.py` and `CHECKOUT_API_VERSION` lives in `.env` (requires
  restart). Version-specific reproduction is a core support task; expose both via a UI selector or
  query param so agents can quickly test against the customer's version.
  *Files:* `app/app.py`, `app/main/config.py`.

- [ ] **Add search/filter and flow labels to the homepage.**
  ~30 integrations are listed as two long unlabeled lists. Add a search box and clear
  Sessions/Advanced tagging so agents can jump straight to the relevant component.
  *File:* `app/templates/home.html`.

---

## P3 - Hygiene, security, and maintainability

- [ ] **Add missing variables to `example.env`.**
  `get_adyen_hmac_key()` and the webhook route require `ADYEN_HMAC_KEY`, but it's absent from
  `example.env` (only `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT`, `ADYEN_CLIENT_KEY`,
  `CHECKOUT_API_VERSION` are present). Add `ADYEN_HMAC_KEY` and optional `PORT` so webhook testing
  works out of the box.
  *File:* `example.env`.

- [ ] **Remove the hardcoded personal email in Click to Pay config.**
  `card.js` sets `shopperEmail: "michael.lichtenberger@adyen.com"` in `clickToPayConfiguration`.
  Replace with a generic placeholder or config value.
  *File:* `app/static/js/advanced/card.js`.

- [ ] **Delete or wire up dead code.**
  `app/main/cardDetails.py` (`adyen_card_details`) is never imported, and
  `get_supported_integration()` in `config.py` is unused and its list is stale/inconsistent with the
  actual integrations. Remove them or connect them to real routes.
  *Files:* `app/main/cardDetails.py`, `app/main/config.py`.

- [ ] **Commit the lock file.**
  `.gitignore` ignores `uv.lock`, which defeats reproducible installs across agents' machines. Track
  it so everyone runs identical dependency versions.
  *File:* `.gitignore`.

- [ ] **Gate `debug=True` and document test-only usage.**
  The app runs with `debug=True` and `host='0.0.0.0'`. Put debug behind an env flag and add a clear
  note that only **test** API keys should be used (never live keys) in this tool.
  *File:* `app/app.py`.

- [ ] **Reduce copy-paste drift between components.**
  `handleOnPaymentCompleted` / `handleOnPaymentFailed` are duplicated verbatim in almost every
  advanced-flow JS file, and several files carry large commented-out blocks (e.g. the stored-card
  section in `card.js`). Extract shared redirect handlers into one included script and remove dead
  comment blocks so behavior stays consistent as components are added.
  *Files:* `app/static/js/advanced/*.js`.

- [ ] **Derive the component script include from the route param.**
  Each component template hardcodes its `<script src=...>`. Since the `integration` route param
  already maps to the template name, derive the script path from it to prevent template/script
  mismatches when agents add new components.
  *Files:* `app/templates/components/**/*.html`, `app/app.py` (`dropin` route).
