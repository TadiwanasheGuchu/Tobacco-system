# Tobacco Floor System

Software for tobacco floors in Zimbabwe, covering both **auction** and **contract** floors. It handles grower registration, bale reception and ticketing, grading, pricing, the grower's accept or reject decision, and settlement with input-loan recovery and the USD/ZiG payment split. It also reports every bale to **TIMB** (Tobacco Industry and Marketing Board).

Built with Next.js 16 (App Router, Server Actions), PostgreSQL and Prisma 7.

## How a bale moves through the system

```
Register grower ──► Receive & weigh ──► TIMB grade ──► Price ──► Grower decision ──► Settlement ──► Payment
 (TIMB verified)     (barcode ticket)    (classifier)   │          │                    (cashier)     (supervisor)
                                                       │          ├─ accept ─► ACCEPTED ─► SETTLED
                     auction floor: buyers bid ────────┤          └─ reject ─► REJECTED ─► re-offer or withdraw
                     contract floor: contractor price list
```

| Status | Meaning |
|---|---|
| `RECEIVED` | Weighed and ticketed at reception |
| `GRADED` | Has a TIMB grade and is waiting for a price |
| `PRICED` | Has a bid or contract price and is waiting for the grower |
| `ACCEPTED` | Grower accepted the price and the bale is waiting for settlement |
| `REJECTED` | Grower rejected the price. The bale can be re-offered or withdrawn |
| `WITHDRAWN` | Grower took the bale off the floor |
| `SETTLED` | The bale is on a settlement statement |

**Auction floors:** buyers grade for themselves, but only the TIMB grade is official. Each new bid has to beat the current one. A supervisor can set a price, and must give a reason.

**Contract floors:** a grower needs a contract for the current season to sell here. Once a bale has a TIMB grade it is priced from the contractor's price list. If the contractor has graded the bale, that grade sets the price; otherwise the TIMB grade does. Input loans are recovered at settlement.

## Roles

| Role | Can do |
|---|---|
| Reception | Register growers, receive bales, record the grower's decision |
| Classifier | Record TIMB grades |
| Buyer | Record the buyer's grade and bid for their own company |
| Cashier | Capture the ZiG rate and prepare settlements |
| Supervisor | Everything on the floor, including price overrides, bids for any buyer, releasing payment, reversals and contracts |
| Admin | Users, floors, seasons, buyers, grades, prices, charges, the TIMB outbox and the audit log |

Payment needs two people: whoever prepares a settlement cannot also release the payment.

## Controls built in

- **Money is exact.** Amounts are stored as `Decimal` and calculated with `decimal.js`, never as floats. Each amount is rounded half-up to cents when it is calculated, so statements add up line by line. See `src/lib/settlement-calc.ts`.
- **Nothing is deleted.** A re-grade, a new bid or a reversal adds a new record. Every action is written to `AuditLog` with the user, the time and the details.
- **Two people can't act on one bale at once.** Bale actions lock the bale's row. Settlement creation locks the grower's accepted bales, so the same bales can't be paid twice.
- **Ticket numbers carry a check digit.** The format is `FLOOR-YY-SEQUENCE-CHECK`, for example `HAF-26-0000001-8`. The Luhn check digit catches most mistakes when a ticket is typed in by hand. Tickets print as Code 128 barcodes.
- **Manual weights are flagged.** A weight typed in at reception is recorded as `MANUAL` and printed with "(M)" on the ticket. Only the scale integration (coming next) will record `SCALE` weights.
- **Rules are data, not code.** Levies, commissions, fees, the USD/ZiG split and contract prices each take effect from a date and are edited under **Admin**. The ZiG rate is captured daily, and settlements with a ZiG portion are blocked until today's rate is in.

## Reports

**Reports** is open to supervisors, cashiers and admins. Choose a date range and a floor to see:

- received and sold bales and mass, sales value, average price, and the rejection rate
- sales by grade, by buyer and by floor
- payouts: gross, each deduction, net, the USD and ZiG amounts, paid versus waiting for release, and the split by payment method
- input loan recovery per contractor for the open season

Each table downloads as a CSV file that opens in Excel. The **payment list** CSV shows each grower's bank or mobile money details next to the amounts. It is the starting point for bank batch files, which come once we know each bank's file format.

A bale counts as sold on the day the grower accepts its price. Bale values are rounded to cents per bale, the same way statements do it, so reports match the statements.

Supervisors and admins can also queue a **TIMB daily summary**: one per floor and day, listing bales, mass and value broken down by TIMB grade. Each floor and day can only be queued once.

Dates use the server's local time. Set `TZ=Africa/Harare`.

## TIMB integration

TIMB does not publish a public API. It gives licensed buyers the integration spec and credentials directly. Because of that, all TIMB-specific code sits behind one interface in `src/lib/timb/adapter.ts`:

- `verifyGrower()` checks the grower number and national ID at registration. If TIMB can't be reached, the grower is saved but cannot sell until verified.
- `submit()` sends `BALE_RECEIVED`, `BALE_SOLD` and `BALE_REJECTED` messages, plus the `DAILY_SUMMARY` queued from Reports.

Messages use a **transactional outbox** (the `TimbOutbox` table):

1. A message is written in the same database transaction as the floor action. If the action commits, the message exists; if it rolls back, the message doesn't.
2. The worker (`npm run worker`) delivers messages. It retries with exponential backoff and claims each message with a lease, so you can safely run more than one worker.
3. Failed messages appear under **Admin → TIMB outbox**, where they can be retried.

`TIMB_MODE=mock` uses `src/lib/timb/mock.ts`. Grower numbers that start with `X` are treated as unknown to TIMB. To build the live integration, write a `TimbAdapter` from TIMB's spec and register it in `src/lib/timb/index.ts`. Nothing else has to change.

## Getting started

Requirements: Node 22+ and PostgreSQL 16.

```bash
cp .env.example .env          # then edit DATABASE_URL
npm install                   # also generates the Prisma client
npm run db:deploy             # apply migrations
npm run db:seed               # demo floors, buyers, grades, prices, growers and users
npm run dev                   # http://localhost:3000
npm run worker                # in a second terminal: delivers TIMB messages
```

The seed creates these accounts, all with the password `ChangeMe2026` (or `SEED_PASSWORD`): `admin`, `supervisor`, `reception`, `reception2`, `classifier`, `buyer1`, `buyer2` and `cashier`.

> **The seeded grades, prices, levies, commission, handling fee, 70% USD split and ZiG rate are samples.** Load the real grade list, the contractors' price lists, the current statutory levies and the day's rate before trading. Confirm the rates with TIMB and finance.

### Scripts

| Script | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | Checks (Vitest unit tests in `tests/`) |
| `npm run db:migrate` | Create a migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Demo data |
| `npm run worker` | TIMB outbox worker |

## Project layout

```
prisma/schema.prisma        data model (read the header comment first)
src/lib/services/           business rules: growers, bales, settlements
src/lib/settlement-calc.ts  pure settlement maths (unit tested)
src/lib/timb/               TIMB adapter interface, mock, outbox
src/lib/auth/               sessions (DB-backed, httpOnly cookie), scrypt passwords, access checks
src/lib/permissions.ts      role → permission map
src/app/(app)/              screens; each folder's actions.ts holds its server actions
scripts/                    seed and TIMB worker
```

Every server action re-checks the session and permission itself (`requireAction`). `src/proxy.ts` only redirects visitors with no session cookie to the login page.

## Roadmap

1. **Scale and printer agent.** A small service on each reception PC that reads the scale over its serial port and prints tickets on Zebra label printers.
2. **Floor server and HQ sync.** Each floor runs on its own server and keeps trading through internet outages, then syncs to head office.
3. **Live TIMB adapter**, once TIMB provides the spec and credentials.
4. **Payment files:** bank batch files and mobile money disbursement, with reconciliation.
5. **Handheld devices:** an installable web app (PWA) for classifiers and buyers on the floor.
