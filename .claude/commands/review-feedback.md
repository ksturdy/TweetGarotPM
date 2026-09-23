# Review Feedback

You are helping the team review, fix, document, and close feedback items submitted through the Titan PM feedback module.

## How to invoke

The user may say any of the following:
- `/review-feedback` — review all open items
- `/review-feedback 96` — review a specific feedback item by ID
- `/review-feedback 96 97 98` — review a list of IDs
- `/review-feedback Charlie` — review items submitted by a specific person
- `/review-feedback submitted` — review items with a specific status
- "Review feedback number 96" / "Review feedback item 96" — plain-language shorthand

Parse the argument as: a numeric ID list, a person's name, a status filter, or no filter (all open items).

---

## Step 1 — Fetch feedback items from the database

Use this pattern to query the database. Always use `ssl: { rejectUnauthorized: false }` and `require('dotenv').config()`.

```js
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\`
  SELECT f.id, f.title, f.description, f.type, f.status, f.priority, f.module, f.submodule,
         f.created_at, f.updated_at,
         u.first_name || ' ' || u.last_name AS submitted_by,
         (SELECT string_agg(c.comment || ' [' || cu.first_name || ' ' || cu.last_name || ']', E'\n---\n' ORDER BY c.created_at)
          FROM feedback_comments c
          JOIN users cu ON cu.id = c.user_id
          WHERE c.feedback_id = f.id) AS comments
  FROM feedback f
  JOIN users u ON u.id = f.user_id
  WHERE f.status NOT IN ('completed','rejected')
  ORDER BY f.id
\`).then(r => { r.rows.forEach(row => console.log(JSON.stringify(row))); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });
"
```

Run this from the `backend/` directory. Add a `WHERE f.id = ANY(ARRAY[...])` clause when reviewing specific IDs. Add `AND (u.first_name || ' ' || u.last_name) ILIKE '%name%'` to filter by submitter.

---

## Step 2 — Read source code for context

For each item, identify the affected module from `f.module` and `f.submodule`, then read the relevant files before proposing a fix. Common locations:

- **Frontend pages**: `frontend/src/pages/<Module>/` or `frontend/src/pages/<module>/<ModulePage>.tsx`
- **Frontend components**: `frontend/src/components/<module>/`
- **Backend routes**: `backend/src/routes/<module>.js`
- **Backend models**: `backend/src/models/<Entity>.js`
- **Services**: `frontend/src/services/<module>.ts`

Read enough code to understand the current behavior before proposing anything. Do not guess.

---

## Step 3 — Propose fixes and wait for approval

For each item, present:

1. **Item**: `#ID — Title` (status, priority, submitted by)
2. **Description**: what the user reported
3. **Root cause** (from reading the code): what's actually happening and why
4. **Proposed fix**: specific files and changes — be concrete, not vague
5. **Suggested resolution**: `completed` (fix is implementable now) or `on_hold` (blocked on external dependency like Vista, third-party API, or major new module)

Group items and present all proposals together. Ask: "Shall I implement these?" and wait for the user's go-ahead before touching any code.

If the user approves some but not all, implement only those approved.

---

## Step 4 — Implement approved fixes

Make the code changes. Test that the fix compiles (TypeScript must have no errors introduced). Do not refactor surrounding code or add extra features.

---

## Step 5 — Add comments to each item (ALWAYS BEFORE changing status)

**Critical ordering rule: INSERT the comment FIRST, then UPDATE the status. Never reverse this.** The status-change notification emails followers and includes the latest comment text. If you update status first and then comment, the notification fires with no context.

Use this pattern (one `node -e` call per item — do not batch):

```js
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Step A: insert comment first
pool.query(
  'INSERT INTO feedback_comments (feedback_id, user_id, comment) VALUES (\$1, \$2, \$3)',
  [FEEDBACK_ID, ADMIN_USER_ID, 'Your comment text here']
).then(() =>
  // Step B: then update status
  pool.query(
    'UPDATE feedback SET status = \$1, updated_at = NOW() WHERE id = \$2',
    ['completed', FEEDBACK_ID]
  )
).then(() => { console.log('done'); pool.end(); })
.catch(e => { console.error(e.message); pool.end(); });
"
```

Look up the admin user ID first if not already known:
```js
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); p.query('SELECT id,first_name,last_name,email FROM users WHERE email=\$1',['admin@tweetgarot.com']).then(r=>{console.log(r.rows[0]);p.end()});"
```

### Comment text guidelines

- For **completed** items: summarize what was fixed, which files changed, and when it will be deployed. Be concise but specific. Example: "Fixed the board scrolling issue by overriding the `.sales-container` height constraint that was incorrectly applied from the shared SalesPipeline.css stylesheet. The Labor Board table now fills the available viewport correctly. Deployed with the next push."
- For **on_hold** items: explain clearly what is blocking it and what would need to happen for it to become active. Example: "This feature requires integration with the Vista ERP API endpoint that is not yet available in the development environment. Placed on hold until the Vista sync layer supports this data. Will revisit when the Vista connection is extended."

---

## Step 6 — Commit and push

After all changes are implemented and all statuses are updated, commit and push:

```bash
git add -A
git commit -m "Feedback: <short summary of what was fixed>"
git push
```

Write a conventional commit message: lead with the module name or "Feedback:", then a one-line summary. Do not list every item ID in the subject line — put details in the body if needed.

---

## Status values reference

| Status | Meaning |
|--------|---------|
| `submitted` | Just came in, not yet looked at |
| `read` | Team has seen it |
| `under_review` | Being evaluated |
| `in_progress` | Actively being worked |
| `in_testing` | Fix built, being verified |
| `completed` | Shipped |
| `on_hold` | Blocked — needs external work |
| `rejected` | Will not fix (explain why in comment) |

---

## Notes

- Always use the admin account's `user_id` when inserting comments so they appear as team responses.
- Never use `window.confirm` or `alert()` in code changes — use `useTitanFeedback()`.
- If a fix touches CSS shared between modules (e.g., `SalesPipeline.css`), check that other modules using the same class are not broken by the change. Prefer inline style overrides on the specific component over modifying shared CSS.
- User search (e.g., for the follower typeahead) must query the `users` table with `is_active = true` and the correct `tenant_id` — never the `employees` HR table.
