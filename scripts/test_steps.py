# scripts/test_steps.py — written test steps for every automated test, kept next to the code.
# Each entry: (pre-conditions, [steps], expected result). The catalogue builder reads this.
# Steps mirror exactly what the Playwright test does, so a person can repeat it by hand.

PORTAL = "https://portal.staging.hatchevent.com"
EO = "Logged in as the test Event Organiser (eo1@example.com) on staging"
VD = "Logged in as the test vendor (vendor1@example.com) on staging"
OUT = "Logged out — use a private / incognito window"
WIZ = [
    "Go to /events/create/wizard",
    "Type \"Birthday\" in \"Create event for\" and press Enter",
]
WHEN = [
    "Event start: pick a date about 60 days ahead, type 10:00, choose AM",
    "Event end: pick the same date, type 04:00, choose PM",
    "Guests: type 25",
    "Click the forward arrow (right of \"Save for later\")",
]
WHERE = ["Choose \"Near me\" and click the forward arrow"]
CATERING = ["Click \"Catering\" and click the forward arrow", "Wait for \"Curated vendors perfect for your occasion\""]
STOP_RFQ = "Do NOT click \"Request for quotation now\" (safety stop)"
STOP_PAY = "Do NOT click the Stripe checkout button (safety stop)"
RSVP_OPEN = ["Go to RSVPs", "Click \"Edit RSVP\" on the first ongoing event", "Wait for \"Let's review your RSVP details\" (can take about 10 seconds)"]

S = {}

# ── Access control ────────────────────────────────────────────────────────────
for i, path in [("01", "/eo"), ("02", "/eo/enquiries"), ("03", "/eo/billing"), ("04", "/vendor/dashboard"),
                ("05", "/vendor/rfqs"), ("06", "/vendor/invoice"), ("07", "/admin")]:
    S[f"AC-TC-{i}"] = (OUT, [f"Open {PORTAL}{path} directly"], "You are sent to the login page (/auth/login) and the Email field is shown")
S["AC-TC-08"] = (OUT, [f"Open {PORTAL}/"], "You land on the public home page (/home)")
S["AC-TC-09"] = (OUT, ["Open /events/create/ai"], "The page opens without asking you to log in (confirm with product that this is intended)")
S["AC-TC-10"] = (OUT, ["Open /this-page-does-not-exist-uat"], "A \"404 Page Not found\" page with a \"Go back home\" button is shown")
for i, path in [("11", "/vendor/dashboard"), ("12", "/vendor/listing"), ("13", "/vendor/invoice")]:
    S[f"AC-TC-{i}"] = (EO, [f"Type {PORTAL}{path} in the address bar"], "You are sent back to the Event Organiser portal (/eo); the vendor page never shows")
S["AC-TC-14"] = (EO, ["Type /admin in the address bar"], "The Admin portal does not open")
for i, path in [("15", "/eo"), ("16", "/eo/enquiries"), ("17", "/eo/address-book")]:
    S[f"AC-TC-{i}"] = (VD, [f"Type {PORTAL}{path} in the address bar"], "You are sent to /vendor/dashboard; the Event Organiser page never shows")
S["AC-TC-18"] = (VD, ["Type /admin in the address bar"], "The Admin portal does not open")
S["AC-TC-19"] = (OUT, ["Log in as eo1@example.com", "Click Logout in the sidebar", "Click \"No\"", "Click Logout again and click \"Yes\"", "Open /eo/billing directly"],
                 "\"No\" keeps you logged in; \"Yes\" goes to the login page; /eo/billing then redirects to login (session really ended)")
S["AC-TC-20"] = (OUT, ["Log in as vendor1@example.com (choose Vendor)", "Click Logout and click \"Yes\"", "Open /vendor/rfqs directly"],
                 "You are logged out and /vendor/rfqs redirects to the login page")

# ── Validation ───────────────────────────────────────────────────────────────
S["NEG-TC-01"] = (OUT, ["Open /auth/login", "Leave Email and Password empty", "Click Login"], "\"Field is required\" appears under both fields; you stay on the login page")
S["NEG-TC-02"] = (OUT, ["Open /auth/login", "Email: uat-auto-nobody@example.com, Password: NotARealPassword1!", "Click Login"], "Message \"Don't have account with this email. Please register first.\"")
S["NEG-TC-03"] = (OUT, ["Open /auth/login", "Email: eo1@example.com, Password: Definitely-Wrong", "Click Login"], "Message \"The provided credentials are incorrect.\"; you stay on login")
S["NEG-TC-04"] = (OUT, ["Open /auth/login", "Type abc123 in Password", "Click the eye icon (Show password)"], "The password becomes readable and the icon changes to \"Hide password\"")
S["NEG-TC-05"] = (OUT, ["Open /auth/forgot-password", "Leave Email empty and click the submit button"], "\"Field is required\" is shown; nothing is sent")
S["NEG-TC-06"] = (OUT, ["Open /auth/register"], "\"Welcome to HatchEvent\", an Event Organiser / Vendor choice, a Continue button and a Google option are shown")
S["NEG-TC-07"] = (EO, ["Go to Settings → Change password", "Leave all three fields empty and click the confirm button"],
                  "\"Current password is required.\", \"New password is required.\" and \"Please confirm your new password.\" are shown")
S["NEG-TC-08"] = (EO, WIZ + ["Leave the dates empty and click the forward arrow"], "Message \"Start date is required\"; you stay on the date step")
S["NEG-TC-09"] = (EO, WIZ + ["Start: date 60 days ahead, 10:00 AM", "End: same date, 09:00 AM", "Guests: 25", "Click the forward arrow"],
                  "Message \"Event end date and time must be after start date and time\"")
S["NEG-TC-10"] = (EO, WIZ + ["Open the Event start date picker", "Look at yesterday's date"], "Yesterday (and every past day) is greyed out and cannot be picked")
S["NEG-TC-11"] = (EO, WIZ + WHEN + WHERE + ["Do not choose any service and click the forward arrow"], "Message \"Please select at least one service\"")
S["NEG-TC-12"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Do not select any vendor and click the forward arrow"], "Message \"Please select at least 1 vendor from any category to continue.\"")
S["NEG-TC-13"] = (EO, ["Go to Address book", "Search: zz-no-such-contact and press Enter"], "\"No data found\" is shown")
S["NEG-TC-14"] = (EO, ["Go to Address book and note \"Total contacts\"", "Click Create Contact", "Leave every field empty and click Create", "Click Cancel"],
                  "Required-field errors are shown, the form stays open, and Total contacts is unchanged after Cancel")
S["NEG-TC-15"] = (EO, RSVP_OPEN + ["Click Continue twice (event name → time → location)", "Clear the event location and click Continue"],
                  "\"Field is required\"; you stay on the location step (nothing is saved)")
S["NEG-TC-16"] = (EO, ["Go to Event services", "Click \"HatchEvent Services\" on the first event", "Select \"Vendor Evaluation Services\" and click Continue"],
                  "On the summary page \"Secure checkout at STRIPE\" is disabled while the Terms box is unticked")
S["NEG-TC-17"] = (VD, ["Go to RFQs", "Search: zz-no-such-rfq and press Enter"], "\"Try a different keyword\" is shown")
S["NEG-TC-18"] = (VD, ["Go to Team", "Click \"Invite teammates\"", "Leave the email empty"], "\"Send invite\" stays disabled (nothing is sent)")
S["NEG-TC-19"] = (VD, ["Open /vendor/credits", "Select \"Package A — 1,000 credits\" and click Continue"],
                  "On the summary page \"Payment via Stripe\" is disabled while the Terms box is unticked")
S["NEG-TC-20"] = (VD, ["Go to Settings → Change password", "Leave the fields empty and click the confirm button"], "\"… password is required\" messages are shown")

# ── EO journey ───────────────────────────────────────────────────────────────
S["EO-TC-01"] = (OUT, ["Open /auth/register", "Click Continue with the email empty", "Type uat-auto-not-submitted@example.com (do not continue)"],
                 "Empty email shows \"Field is required\"; the email field accepts input. Account creation itself is done by Laurent/iFoundries")
S["EO-TC-02"] = ("A new account just registered", ["Open the OTP email", "Enter the code on the verification screen"], "Account is verified and you reach the dashboard (MANUAL — needs a real inbox)")
S["EO-TC-03"] = (OUT, ["Open /auth/login", "Look for the Google option", "(Manual) Click it and finish the Google sign-in yourself"], "\"Continue with Google\" is offered; Google login completes (BUG-57 for mobile)")
S["EO-TC-04"] = (OUT, ["Open /auth/login", "Email eo1@example.com, password from the test-account sheet", "Click Login"], "You land on /eo with \"Hi Demo\" and a membership number EOP…")
S["EO-TC-05"] = (OUT, ["Open /auth/login", "Click \"Forgot your password?\""], "The forgot-password page opens with an email field (reset email not sent by automation)")
S["EO-TC-06"] = (EO, ["Go to Profile"], "Membership, Account type, Membership no, Mobile number, Country, First name, Last name and the email are shown — no \"undefined\" / \"null\"")
S["EO-TC-07"] = (EO, ["Go to Profile", "Look for an Edit option"], "MANUAL — no edit option exists on web today (finding Q-05)")
S["EO-TC-08"] = (EO, ["On the Dashboard click \"Create new event\""] + WIZ + WHEN + WHERE + CATERING + ["Click the first vendor card", "Click the forward arrow", STOP_RFQ],
                 "Event creation opens; each Wizard step loads; the last screen shows \"Save for later\" and an enabled \"Request for quotation now\"")
S["EO-TC-09"] = (EO, WIZ + ["Click forward with no date", "Fill the date step as normal and continue", "On services, click forward with nothing chosen"],
                 "\"Start date is required\", then \"Please select at least one service\"")
S["EO-TC-10"] = (EO, ["Go to Event enquiries", "Filter: Draft", "Find \"UAT-AUTO Wizard Draft\"", "Click the \"Edit dates\" icon"],
                 "The draft is listed with an EE number; Edit dates reopens the Wizard (/wizard/details?mode=edit) at \"When is your event?\"")
S["EO-TC-11"] = (EO, WIZ + WHEN + WHERE + ["Check the 5 categories", "Click Catering and the forward arrow"],
                 "Event Venues, Catering, Entertainment, Logistics and Others are shown; Catering highlights; vendor cards with prices load. Check ranking (BUG-46) and distance (BUG-59) by eye")
S["EO-TC-12"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Note the first vendor's name", "Click its eye (Preview) icon"],
                 "The vendor detail page (/vendor-detail/…) shows that vendor's name and listing details")
S["EO-TC-13"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Select one vendor", "Click the forward arrow", STOP_RFQ], "\"Request for quotation now\" is enabled")
S["EO-TC-14"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Click 4 vendor cards", "Click the forward arrow", STOP_RFQ],
                 "Only 3 cards stay selected (maximum 3); the final screen appears")
S["EO-TC-15"] = (EO, ["Go to Event enquiries", "Look at the Vendor quotations tables", "Click \"View vendor details\", then Close"],
                 "Each quotation has a status (Selected, Pending, Submitted, Acknowledged, Rejected, Offline …) — never \"Unknown\"; vendor details open and close")
S["EO-TC-16"] = (EO, ["Go to Event enquiries", "Find a submitted quotation"], "An \"Acknowledge\" button is shown (do not click — it accepts a real quotation)")
S["EO-TC-17"] = ("A disposable RFQ with a submitted quotation", ["Reject the quotation and give a reason"], "MANUAL — status becomes Rejected and the vendor is told")
S["EO-TC-18"] = (EO, ["Go to Event services → HatchEvent Services", "Select Vendor Evaluation Services, click Continue", "Tick \"I confirm that I have read…\"", STOP_PAY],
                 "Summary shows $100; \"Secure checkout at STRIPE\" is disabled before ticking and enabled after")
S["EO-TC-19"] = ("Stripe test mode", ["Pay with test card 4000 0000 0000 0002"], "MANUAL — a clear \"card declined\" message, no order created")
S["EO-TC-20"] = (EO, ["Go to Billing", "Click \"View invoice PDF\" on the first row"], "A .pdf downloads with a real name (not \"stream\") and opens as a PDF (BUG-29)")
S["EO-TC-21"] = (EO, RSVP_OPEN + ["Continue through: event name → time → location → additional guests → event URL",
                                  "On the background step pick \"Birthday Party RSVP\" and Continue", "Stop on \"Let's create your RSVP\" (do not click Preview)"],
                 "Every step is pre-filled; the design editor opens; the overlay slider is 0.5 or lighter (BUG-21)")
S["EO-TC-22"] = (EO, ["Go to RSVPs", "Click \"Purchase Package\" on the first event", "Select Gold Package, click Continue", "Tick the Terms box", STOP_PAY],
                 "Gold, Silver and Bronze are shown; summary says \"$ 200 / event\" with no monthly price (BUG-44); Stripe button enables only after ticking")
S["EO-TC-23"] = (EO, ["Go to RSVPs", "Check the invite counters"], "Pending invite / Confirmed / Declined / Awaiting response counters are shown. Sending (Start Campaign) is MANUAL")
S["EO-TC-24"] = (EO, ["Go to RSVPs and note each event's numbers", "Go to the Dashboard and note \"Total RSVP sent\""],
                 "For every event Confirmed + Declined + Awaiting is not more than RSVP sent; dashboard total is a valid number")
S["EO-TC-25"] = (EO, ["Go to Event enquiries", "Filter: Past", "Click the first past event to expand it"], "1–5 star rating buttons are shown on the vendor row (do not click — it posts a real review)")
S["EO-TC-26"] = (EO, ["Click each sidebar link in turn: Event enquiries, Event services, Event guest list, Address book, RSVPs, Billing, Profile, Settings, Dashboard"],
                 "Each link opens its page with the right heading (Billing's heading is \"Invoices\")")
S["EO-TC-27"] = (EO, ["On the Dashboard look for \"Manage in App\""], "If present it opens the app page without a 404; today the button is not on the dashboard")
S["EO-TC-28"] = (EO, ["Go to Event guest list", "Click \"Manage in app\" on the first event"], "A new tab opens on hatchevent.com — no 404 (BUG-03/20)")
S["EO-TC-29"] = (EO, ["Look at the sidebar"], "On staging, RSVPs and Event services are visible. Production hiding (BUG-32) is checked by hand")
S["EO-TC-30"] = (EO, ["Resize the browser (or use phone mode) to 390 × 844", "Open the Dashboard"], "\"Hi Demo\" shows, no sideways scrolling, \"Create new event\" is on screen")
S["EO-TC-31"] = (EO, ["Go to Event enquiries", "Read every quotation status"], "No status reads \"Unknown\" (BUG-37)")

# ── Vendor journey ───────────────────────────────────────────────────────────
S["VD-TC-01"] = (OUT, ["Open /auth/register", "Choose Vendor", "Click Continue with the email empty"], "\"Field is required\" (account creation itself is done by Laurent/iFoundries)")
S["VD-TC-02"] = ("A new vendor just registered", ["Enter the OTP from the email"], "MANUAL — account verified")
S["VD-TC-03"] = (OUT, ["Open /auth/login", "Choose Vendor"], "\"Continue with Google\" is shown; finishing Google login is MANUAL")
S["VD-TC-04"] = (OUT, ["Open /auth/register", "Click \"Knowledge Base\" and \"Frequently Asked Questions\" in the footer"], "Both open real pages, no 404 (BUG-06)")
S["VD-TC-05"] = (VD, ["Go to Profile"], "Company name, Membership no, Account type \"Company\", UEN No, GST Registration No, Company contact number and Designation are shown")
S["VD-TC-06"] = (VD, ["Upload business documents"], "MANUAL — no upload on the web profile today; confirm where documents are collected")
S["VD-TC-07"] = (VD, ["Upload a logo and a cover image"], "MANUAL — images saved and shown")
S["VD-TC-08"] = (VD, ["Open /vendor/membership"], "Gold, Silver, Bronze cards, \"YOUR CURRENT TIER\" on Gold, Gold priced $2,400 / year")
S["VD-TC-09"] = (VD, ["Go to Membership (sidebar)"], "Membership Record, Buy Listings, an Order ID and the membership cycle dates are shown. Paying for an upgrade is MANUAL")
S["VD-TC-10"] = (VD, ["Open /vendor/listing/create"], "\"Create my own listing\" and \"Get help from the Hatch Event team\" are offered. Category duplicates (BUG-14) are checked by hand — Continue reserves a listing number")
S["VD-TC-11"] = (VD, ["Add a photo under 10 MB to a listing"], "MANUAL — photo uploads")
S["VD-TC-12"] = (VD, ["Add a photo over 10 MB"], "MANUAL — clear \"too large\" message (BUG-28)")
S["VD-TC-13"] = (VD, ["Go to Listing", "Click Edit on the first listing"], "The listing form opens in edit mode (/vendor/form?mode=edit). Changing the type (BUG-13) is checked by hand")
S["VD-TC-14"] = (VD + "; second window logged in as eo1", ["Vendor: note the live catering listing name on Listing", "EO: run the Wizard to the Catering results"],
                 "The vendor's live listing appears in the organiser's results")
S["VD-TC-15"] = ("Admin portal", ["Create a listing for a vendor"], "MANUAL (BUG-30)")
S["VD-TC-16"] = (VD, ["Go to RFQs"], "Current RFQs show enquiry no, event date, pax, category, listing and status. Email notification is MANUAL")
S["VD-TC-17"] = (VD, ["Go to RFQs", "Click \"View all\""], "The list opens, no 404 (BUG-15)")
S["VD-TC-18"] = (VD, ["Go to RFQs", "Click the \"Expired\" filter"], "Expired RFQs show \"Expiry reason\" and no Submit, Purchase, Reject or Accept buttons (BUG-31/40)")
S["VD-TC-19"] = (VD, ["Go to RFQs", "Find a pending RFQ"], "A Reject button is shown (BUG-35). Rejecting with a reason is MANUAL")
S["VD-TC-20"] = (VD, ["Click each sidebar link: Dashboard, Listing, RFQs, Membership, Credits and points, Sponsored links, EDMs, Invoices, Profile, Team, Settings"],
                 "Each opens its page with the right heading")
S["VD-TC-21"] = (VD, ["Scroll to the footer", "Under \"Vendors\", click Membership"], "The Membership page opens (BUG-33)")
S["VD-TC-22"] = (VD, ["Open /vendor/edm", "Choose a listing in \"Select vendor listing\""], "EDM packages should appear. TODAY: none appear and Continue stays disabled (NEW-02)")
S["VD-TC-23"] = (VD, ["Go to Team", "Click \"Invite teammates\""], "Role counts are shown; Send invite is disabled until an email is entered (never sent)")
S["VD-TC-24"] = (VD, ["Go to Invoices", "Click the download icon on the first row"], "A real-named .pdf downloads (BUG-29)")
S["VD-TC-25"] = (VD, ["Resize to 390 × 844", "Open the Dashboard"], "\"Hi Demo Vendor1\" shows with no sideways scrolling")
S["VD-TC-26"] = (OUT, ["Open /auth/register", "Click \"Terms of Use\" and \"Privacy Policy\""], "Both pages open (BUG-34)")

# ── RFQ process ──────────────────────────────────────────────────────────────
S["RFQ-TC-01"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Select one vendor, click forward", STOP_RFQ], "\"Request for quotation now\" is enabled")
S["RFQ-TC-02"] = (EO, WIZ + ["Click forward with no date"], "\"Start date is required\"; the RFQ button never appears")
S["RFQ-TC-03"] = (EO, WIZ + WHEN + WHERE + CATERING + ["Select 2 vendors"], "Both cards show as selected")
S["RFQ-TC-04"] = (VD, ["Go to RFQs", "Click the \"Event organiser info\" icon on an RFQ", "Close"], "RFQs show an EE number; \"Event organiser details\" opens (BUG-58)")
S["RFQ-TC-05"] = (VD, ["Buy an RFQ, add several line items"], "MANUAL — totals add up automatically (BUG-54)")
S["RFQ-TC-06"] = (VD, ["Set a deposit % and balance due date"], "MANUAL — saved and shown to the organiser")
S["RFQ-TC-07"] = (EO, ["Wait for a vendor to submit a quotation"], "MANUAL — email received (BUG-47)")
S["RFQ-TC-08"] = (EO, ["Go to Event enquiries"], "\"Acknowledge\" is enabled on a submitted quotation (not clicked)")
S["RFQ-TC-09"] = (EO, ["Reject a quotation with a reason"], "MANUAL")
S["RFQ-TC-10"] = (EO, ["Go to Event enquiries"], "No error text, stack trace or server error appears (BUG-18)")
S["RFQ-TC-11"] = (EO, ["Look for a PDF button under Quote price"], "MANUAL — no PDF button on today's layout (BUG-19)")
S["RFQ-TC-12"] = ("Accepted quotation", ["Pay the deposit"], "MANUAL — Stripe test mode")
S["RFQ-TC-13"] = ("Accepted quotation", ["Pay by card 4242 4242 4242 4242"], "MANUAL — payment succeeds, status updates")
S["RFQ-TC-14"] = ("Accepted quotation", ["Pay by FPX bank transfer"], "MANUAL")
S["RFQ-TC-15"] = (EO, ["Go to Billing", "Compare \"Total invoices\" and \"Total amount\" with the rows in the list"],
                  "The numbers should match. TODAY: summary 6 invoices / $2,027 vs 5 rows / $1,155 (NEW-03)")
S["RFQ-TC-16"] = (VD, ["Go to RFQs", "Click the Expired filter"], "Expired RFQs show \"Expiry reason\" and no Submit, Purchase or Reject (BUG-31/40)")
S["RFQ-TC-17"] = (EO, ["Wait until every vendor misses the deadline"], "MANUAL — organiser is notified")
S["RFQ-TC-18"] = (EO, ["Go to Event services"], "\"Buy other services\" is offered (BUG-36)")

# ── Event service & RSVP ─────────────────────────────────────────────────────
S["SVC-TC-01"] = (VD, ["Open the Dashboard"], "Counters New, Accepted, Pending, Rejected, Completed and Expired are shown with numbers")
S["SVC-TC-02"] = (VD, ["Go to RFQs", "Open the status filter"], "Accepted, Acknowledged, Completed and Expired are options")
S["SVC-TC-03"] = (VD, ["Mark a job \"In progress\""], "MANUAL — mobile app")
S["SVC-TC-04"] = (VD, ["Go to RFQs", "Click the Completed filter"], "Expired RFQs disappear from Past RFQs")
S["SVC-TC-05"] = (EO, ["Event enquiries → Filter: Past", "Expand the first past event"], "The 1–5 star rating is shown (BUG-39)")
S["SVC-TC-06"] = (EO, WIZ + WHEN + WHERE + CATERING, "Vendor cards show a rating such as \"5.0 ⭐\"")
S["SVC-TC-07"] = (EO, RSVP_OPEN, "Event name is pre-filled and the steps \"Create — Invite — Selection — Summary — Complete\" are shown")
S["SVC-TC-08"] = (EO, ["Go to RSVPs → Purchase Package", "Select Bronze, Continue", "Tick the Terms box", STOP_PAY],
                  "\"Secure checkout at STRIPE\" is disabled, then enabled after ticking")
S["SVC-TC-09"] = (EO, ["Go to Billing", "Click the \"RSVP Packages\" tab", "Click View invoice PDF on the first row"], "A .pdf downloads (BUG-22)")
S["SVC-TC-10"] = ("Live RSVP campaign", ["Open the RSVP link as a guest and respond"], "MANUAL (BUG-49)")
S["SVC-TC-11"] = (EO, ["Go to RSVPs", "Find an event with no package"], "\"No RSVP package purchased for this event\" and no clickable Resend (BUG-04/50)")
S["SVC-TC-12"] = (EO, ["Go to Event guest list", "Click CSV on the first event"],
                  "A .csv downloads with header ID, First Name, Last Name, Email, Phone, Group, Permission, Plus Ones")
S["SVC-TC-13"] = ("EO mobile app", ["Check a guest in"], "MANUAL (BUG-48)")
S["SVC-TC-14"] = (EO, ["Complete the post-event survey"], "MANUAL")
S["SVC-TC-15"] = ("EO mobile app", ["Tap the message icon"], "MANUAL (BUG-05)")
S["SVC-TC-16"] = (EO, RSVP_OPEN + ["Note the event name and EE number", "Go to RSVPs, then Event enquiries"],
                  "The same name appears next to the same EE number on all three pages (BUG-38)")

# ── Bug regressions & new findings ───────────────────────────────────────────
S["REG-BUG-07"] = (OUT, ["Open /home", "Click Blog"], "The blog page opens (BUG-07)")
S["REG-BUG-43"] = (EO, ["Go to Event enquiries"], "The envelope \"Send vendor summary email\" button is shown (BUG-43)")
S["REG-BUG-41"] = (EO, ["Go to RSVPs → Purchase Package", "Find the word \"here\""], "\"here\" should be a working link. TODAY: plain text (BUG-41 still open)")
S["REG-BUG-45"] = (EO, ["Open /eo/rsvp/package directly (bookmark)"], "Packages should show. TODAY: no packages (BUG-45 still open)")
S["REG-BUG-45b"] = (EO, ["Go to RSVPs → Purchase Package", "Press F5 to refresh"], "Packages should still show. TODAY: they disappear (BUG-45)")
for sfx, path in [("a", "/eo/billing"), ("b", "/eo/enquiries"), ("c", "/eo/rsvp"), ("d", "/eo/services"), ("e", "/eo/guest-list")]:
    S[f"NEW-01{sfx}"] = (EO, [f"Open {path}", "Click Export"], "A file should download. TODAY: nothing happens (NEW-01)")
for sfx, path in [("f", "/vendor/rfqs"), ("g", "/vendor/invoice"), ("h", "/vendor/listing")]:
    S[f"NEW-01{sfx}"] = (VD, [f"Open {path}", "Click Export"], "A file should download. TODAY: nothing happens (NEW-01)")
S["NEW-04"] = (VD, ["Open /vendor/credits"], "Real package text. TODAY: \"lorem ipsum\" (NEW-04)")
S["NEW-05"] = (EO, ["Event services → HatchEvent Services", "Select Vendor Evaluation Services, Continue"],
               "Wording should be about HE Services. TODAY: title \"HatchEvent RSVP Menu\" and \"RSVP Package\" text (NEW-05)")
S["NEW-06"] = (EO, ["Event enquiries → Filter: Draft, note the draft names", "Go to Event guest list"], "Drafts should not be under Ongoing Events. TODAY: they are (NEW-06)")
S["NEW-07"] = (EO, RSVP_OPEN + ["Continue to \"Upload your e-Invite background\""], "Only real templates. TODAY: \"ergergerg\" is listed (NEW-07)")
S["NEW-08"] = (EO, WIZ + ["Inspect the arrow buttons with a screen reader"], "They should be announced as Back / Next. TODAY: no name (NEW-08)")
S["NEW-09"] = (OUT, ["Open /auth/login", "Click each Follow Us icon in the footer"], "Each opens a social profile. TODAY: they link to \"#\" (NEW-09)")
S["NEW-10"] = (EO, WIZ + ["Event end: type 04:00, then choose PM"], "Field should read 04:00 PM. TODAY: 16:00 PM (NEW-10)")
S["NEW-10b"] = (EO, WIZ + ["Event end: choose PM first", "Then type 06:00"], "PM should stay selected. TODAY: flips to AM and 06:00 AM is sent to the server (NEW-10, High)")
S["NEW-10c"] = (EO, WIZ + ["Event end: type 09:00", "Click the field again and type 04:00"], "Field should read 04:00. TODAY: stays 09:00 (NEW-10)")
S["NEW-11"] = (EO, ["Event enquiries → Filter: Past", "Press Tab to reach an event card and press Enter"], "The card expands. TODAY: cannot be reached by keyboard (NEW-11)")

# ── Page health ──────────────────────────────────────────────────────────────
HEALTH = ["Open the page directly", "Time from opening to the page heading showing",
          "Look for \"undefined\", \"NaN\", broken images and \"lorem ipsum\"", "Check the browser console / network for errors"]
HEXP = "Heading shows within 10 s (5 s target); no undefined/NaN, broken images or placeholder text; no API 5xx and no JavaScript errors"
for i, (label, path) in enumerate([("Dashboard", "/eo"), ("Event enquiries", "/eo/enquiries"), ("Event services", "/eo/services"), ("Event guest list", "/eo/guest-list"),
                                   ("Address book", "/eo/address-book"), ("RSVPs", "/eo/rsvp"), ("Billing", "/eo/billing"), ("Profile", "/eo/profile"), ("Settings", "/eo/settings")], 1):
    S[f"HLT-TC-{i:02d}"] = (EO, [f"Page: {label} ({path})"] + HEALTH, HEXP)
for i, path in enumerate(["/eo/favourite-vendor", "/events/create/ai", "/events/create/wizard", "/eo/settings/change-password"], 10):
    S[f"HLT-TC-{i:02d}"] = (EO, [f"Page: {path}"] + HEALTH, HEXP)
for i, (label, path) in enumerate([("Dashboard", "/vendor/dashboard"), ("Listing", "/vendor/listing"), ("RFQs", "/vendor/rfqs"), ("Membership", "/vendor/member-ship"),
                                   ("Credits and points", "/vendor/credit-points"), ("Sponsored links", "/vendor/sponsored-links"), ("EDMs", "/vendor/edms"),
                                   ("Invoices", "/vendor/invoice"), ("Profile", "/vendor/profile"), ("Team", "/vendor/team"), ("Settings", "/vendor/settings")], 20):
    S[f"HLT-TC-{i:02d}"] = (VD, [f"Page: {label} ({path})"] + HEALTH, HEXP)
for i, path in enumerate(["/vendor/membership", "/vendor/credits", "/vendor/edm", "/vendor/listing/create"], 31):
    S[f"HLT-TC-{i:02d}"] = (VD, [f"Page: {path}"] + HEALTH, HEXP)

# ── Write flows (UAT-AUTO data) ──────────────────────────────────────────────
S["WR-TC-01"] = (EO, ["Address book → Create Contact", "First UAT-AUTO, Last Contact, email uat-auto+<time>@example.com, phone 88880000 → Create",
                      "Search for that email", "Open actions → Edit contact → Group: UAT → Save", "Open actions → Delete → Delete"],
                 "\"Contact created successfully.\"; found by search; group shows UAT; \"Contact permanently deleted successfully.\"; Total contacts back to the starting number")
S["WR-TC-02"] = (EO, ["Event enquiries → Filter: Draft", "If no \"UAT-AUTO Wizard Draft\": run the Wizard to the end and click Save for later, then rename it",
                      "Edit event name → \"UAT-AUTO Wizard Draft (renamed <date>)\" → Save", "Refresh", "Rename back to \"UAT-AUTO Wizard Draft\""],
                 "\"Event name updated successfully.\" each time; the new name survives a refresh; the original name is restored")
S["WR-TC-02b"] = (EO, ["Event enquiries → Filter: Draft", "Edit event name on UAT-AUTO Wizard Draft", "Type SHOULD NOT SAVE → Cancel"], "The name is unchanged")
S["WR-TC-03"] = (EO + " (only when WRITE_FLOWS=rsvp)", RSVP_OPEN + ["Continue to the background step, pick Birthday Party RSVP", "Click Preview RSVP, then Save and continue"],
                 "Preview shows RSVP Now / Decline; the Invite step offers Add a single contact, Import contacts, Add via the app, plus the Legal Disclaimer")
S["WR-TC-04"] = (EO + " (only when WRITE_FLOWS=rsvp)", ["Do WR-TC-03 to the Invite step", "Read the button wording"],
                 "Should say \"Event guest list\" like the sidebar. TODAY: \"Guest List Management dashboard\" (BUG-55)")
