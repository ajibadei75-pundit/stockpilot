# StockPilot: setup and deployment

Static PWA (index.html + manifest.json + sw.js + icon.svg) on a Supabase backend.
Project: `twjqkymbwqxdzxxmjqej` (eu-west-2). URL: https://twjqkymbwqxdzxxmjqej.supabase.co

## 1. Deploy (about 2 minutes)
Drag the whole `stockpilot-site` folder onto https://app.netlify.com/drop (or use Vercel, Cloudflare Pages, GitHub Pages). HTTPS is required for install and offline.
The site cannot sign in from inside Claude's preview; it must run on your own domain.

## 2. Supabase dashboard settings (required, done once)
1. Authentication > URL Configuration: set **Site URL** to your deployed URL and add it to **Redirect URLs** (needed for confirmation and password-reset emails).
2. Authentication > Providers > Email: keep "Confirm email" on for production. Turn it off only while testing.
3. Authentication > Attack Protection: enable leaked-password protection and CAPTCHA if available.
4. Authentication > Rate Limits: keep defaults or tighten.
5. Optional: enable MFA (TOTP) for admins.
6. Project Settings > Database > Backups: turn on daily backups (paid plans give point-in-time recovery).

## 3. Setup and daily use
1. Sign in as the Super Admin and change the password and email under *My account*.
2. Shops > create a shop > send the owner invite link (Copy or WhatsApp). The owner opens it, enters name, email and password, and starts straight away.
3. The owner opens **Settings**: logo, colour, name, phone, address, receipt message, type of shop. These appear on the app, receipts and PDF reports.
4. The owner opens **Team** and creates logins for the **store keeper** (sees only the Sales page: sell, print receipts, own recent sales) and **viewers** (statistics, stock, and optionally sales and reports). Give them the email and password. The owner can stop access or set a new password at any time. Only people created from Team can have their password changed by the owner.
5. **Reports** makes a detailed PDF with a QR code. Anyone who scans the QR sees the shop, dates and time it was made (no money figures); the report carries a fingerprint to detect changes.

## 4. How isolation works
- Every business table has `shop_id` and row-level security. All writes go through RPC functions that check the caller's role in the database.
- The platform admin account can read shop names, status and invitation counts only. It has no policy that reads products, stock, sales, payments or receipts.
- Cashiers read products through a view without cost price. Viewers cannot write anything. Stock, ledger, audit and report logs are append-only.
- Checkout is atomic and idempotent (unique key per shop), recomputes prices server-side, locks the shop row, and deducts stock exactly once.
- Transfers, USSD and card payments stay "submitted" until the owner confirms. Rejecting restores stock.

## 5. Metrics
Gross = sum of item subtotals. Net = total after discount, including VAT. Cash/transfer/USSD/POS = confirmed payments only. Awaiting verification = submitted payments. Voided sales are excluded. Gross profit = net − VAT − cost of goods (needs accurate cost prices).

## 6. Backups and recovery
Use Supabase backups, plus a periodic `pg_dump` of the project database. Test a restore on a new project before relying on it.

## 7. Offline, sync, backup and updates
- **Install:** open the site in Chrome/Edge/Android and press *Install app* (iPhone: Share > Add to Home Screen).
- **Offline selling:** the product list is cached on the device. With no connection a sale is saved on the device with a unique key and a receipt marked *NOT YET SYNCED*. It is never shown as recorded or paid until the server accepts it. When data comes back it syncs automatically (on reconnect and every 30 s). Sales the server refuses (for example not enough stock) stay listed with the reason so you can retry or discard them. Duplicate protection means a retried sale is never recorded twice.
- **Offline reading:** pages you have opened (dashboard, products, sales, alerts) show a saved read-only copy when offline. Saved copies and the product cache are wiped on sign-out. Unsynced sales are kept so nothing is lost; do not use shared devices for owner accounts.
- **Live updates:** while online, dashboards, sales, stock and alerts refresh by themselves when anything changes.
- **JSON backup:** Settings > *Download backup (JSON)* exports products, prices, stock ledger, sales, payments, alerts and audit trail with a SHA-256 checksum, and logs the download. A reminder appears if no backup was made for 7 days.
- **Restore:** Settings > *Restore from backup* verifies the checksum and that the file belongs to the same shop, then re-creates missing categories and products with their stock and re-queues unsynced sales. It never overwrites existing products or rewrites sales history. For a full database restore use Supabase backups (section 6).
- **App updates:** a new deploy shows *Update now* and reloads into the new version.

## 8. Shops, insights, printing and design
- **Shop types:** Settings > Type of shop (provision store, frozen foods, egg depot, drinks depot, building materials, pharmacy, general). The type sets suggested units (e.g. tray and crate for eggs, kg for frozen foods) and a one-tap **Add suggested sections**. Units are not auto-converted: sell trays and pieces as two items if you need both.
- **Best sellers (owner and viewer):** best-selling items with change versus the previous period, best seller in each section, best day, best day of the week, top days and a plain-language summary.
- **Receipt printers:** Settings > Paper size (58 mm roll, 80 mm roll, A4). Press *Print receipt* after a sale; the browser prints only the receipt. For thermal printers choose the printer in the print dialog and set margins to none/default and scale 100%.
- **Day and night mode:** sun/moon button on every screen (remembered per device). *Bigger text* is in the side menu or More menu.
- **Layout:** bottom tabs on phones, side menu on tablets and computers.
- **Super Admin:** sign in with the Super Admin account, then change its email and password under *My account*.

- **Out-of-stock alerts:** when any item reaches zero (from a sale, write-off or rejected payment) the server creates one alert. Owners, cashiers and viewers see a flashing red banner on every page, a flashing badge on Alerts, flashing “OUT OF STOCK” labels on items, a pop-up with a beep, and, if the person taps *Turn on phone alerts*, a system notification. The banner stays until the item is restocked. Alerts only reach a phone while the app is open or running in the background; alerts when the app is fully closed or by email/SMS need a push or email service, which is not set up yet. Flashing becomes a steady red for people who use “reduce motion”.

## 9. Email setup (stock alerts by email)
Alerts are queued in the database the moment an item reaches its minimum quantity or runs out (one email per item per event; a new one is sent only after the item has been restocked). The Edge Function `send-alert-emails` (already deployed) sends them and retries failures every 5 minutes. It needs a mail provider:
1. Create a free account at https://resend.com and make an API key. To email any inbox, verify your own domain there (without a domain, Resend only delivers to your own account email).
2. Supabase Dashboard > Edge Functions > Secrets: add `RESEND_API_KEY` = your key and `MAIL_FROM` = `StockPilot <alerts@your-domain.com>`.
3. In the app, Settings > Email alerts: add up to 5 addresses, press **Send test email**. The list below shows Sent / Waiting / Failed.
- Each email names the item, quantity left, the minimum you set, the shop number and name (for owners with several shops), and the real time it happened in Lagos time. Sales made offline keep their real time and the email is sent after they sync (the email says it happened offline).
- With no address added, emails go to the owner's login email.
- Until the secrets are added, emails stay "Waiting" and nothing is lost; they send automatically after setup.

## 10. Payment totals, stock bars, printing and guide
- **Money by payment method:** Home (today), Best sellers (7/30/90 days) and printed Reports show Cash, Bank transfer and Others (USSD + POS card) with sales counts, the **Total received**, and money still waiting to be checked shown separately. Only confirmed payments are counted; cancelled sales are left out.
- **Stock colour bars:** dark green (full), light green (good), yellow (getting low), red (at or below the minimum, or out). The bar shrinks as stock is sold. "Full" is the item's *full stock level* (set under Items > Edit, optional) or, if empty, the highest stock the item has had.
- **Printing:** normal print for any printer (58 mm, 80 mm or A4), plus direct **Bluetooth** ESC/POS printing from Chrome or Edge (Android and computers) to receipt printers that use Bluetooth LE. Settings > Receipt printer has Connect, Print test receipt and "print straight after each sale". Not supported: iPhone Safari, and classic-Bluetooth-only printers (use the normal Print button or the printer's own Android print service). Direct Bluetooth printing could not be tested on physical printers; run the test receipt on yours.
- **Reports:** Print / save as PDF now includes summary, payment totals, best sellers, best seller per section, best day and stock status.
- **Guide:** in-app step-by-step guide for each role (Guide tab).

## 11. Troubleshooting
- **"localhost refused to connect" after signing up:** this came from Supabase's default Site URL (`http://localhost:3000`) used in confirmation emails. Invitation sign-up no longer sends a confirmation email. Also set Authentication > URL Configuration > Site URL to your real address so password-reset emails work.
- **Optional hardening:** Authentication > Sign In / Providers > turn off *Allow new users to sign up*. Invitation sign-up still works because it uses the server function.
- **Owner cannot see the shop:** they must open the invitation link while signed out or sign in and paste it under *Join a shop*. Create a new owner invite if it expired.
- **Emails stay "Waiting":** add `RESEND_API_KEY` and `MAIL_FROM` secrets (section 9).

## 11b. Who can do what with stock
Only the **owner** can add items, add stock, edit prices, mark damaged or expired goods, and import a list (Items > *Import list (CSV)*, columns: name, code, price, cost, stock, minimum, unit, category; use *Download template*). The database enforces this, so a store keeper or viewer cannot change stock even by calling the server directly. The store keeper only sells: item tiles show the name and price, a cart, the payment method and Complete sale, plus their last 10 sales. No discounts, stock figures, alerts or settings are shown to them (and the server allows them no discount).

## 12. Simplifications in this version
VAT is removed (all prices are final, no tax line on receipts or reports). Email alerts are removed; stock warnings appear in the app (flashing banner, colour bars). Reports are PDF only (no CSV). Store keepers have a single Sales page. The `send-alert-emails` function is no longer used and can be deleted from the Supabase dashboard.

## 13. Not included yet
Email/push notifications, bank-API payment confirmation, units conversions, stocktakes, shifts, split payments, automated tests.
