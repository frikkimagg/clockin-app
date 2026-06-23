# Clock — PIN-based time clock

A simple web app for your team to clock in and out using a 4–8 digit PIN
instead of a username and password. There's also an admin page where you can
see everyone's hours and add or remove team members.

This guide assumes no coding experience — just follow the steps in order.

---

## What you need before you start

1. A **Supabase account** (free) — this is where the clock data gets stored.
2. A **GitHub account** (free) — this is where the app's code lives so
   Netlify can find it.
3. A **Netlify account** (free) — this is what actually runs the app and
   gives you a web address.

You already use this same combination (GitHub → Netlify, with Supabase as
the database) for the Igdlo Guesthouse portal, so the overall shape will
feel familiar even though this is a separate, unrelated app.

---

## Step 1 — Set up the database in Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project
   (pick any name and password — you won't need to remember the password
   for this app).
2. Once the project is ready, click **SQL Editor** in the left sidebar.
3. Open the file `supabase-schema.sql` from this folder, copy everything
   in it, and paste it into the SQL Editor. Click **Run**.
   - This sets up three tables: one for companies, one for employees, and
     one for clock-in/out records. It also seeds two companies to start
     (Greenland Craftworks ApS, Hotel Narsaq ApS) — you can rename these
     or add more later directly in Supabase's **Table Editor**.
4. Click **Project Settings** (gear icon) → **API**. You'll need two values
   from this page in Step 3:
   - **Project URL**
   - **service_role key** — click "Reveal" to see it. This is a secret key,
     similar to a password. Don't share it or post it anywhere public.

---

## Step 2 — Put the code on GitHub

1. Go to [github.com](https://github.com) and create an account if you
   don't have one.
2. Click the **+** in the top right → **New repository**. Give it a name
   like `clock-app`. You can leave it **Private**. Click **Create
   repository**.
3. On the new repo's page, look for a link that says something like
   **"uploading an existing file"**. Click it.
4. Unzip the `clock-app.zip` file you downloaded, then drag the entire
   contents of the `clockapp` folder into that GitHub upload page (the
   `app` folder, `package.json`, `README.md`, everything — but you can
   skip the `node_modules` folder if you see one, it isn't included in the
   zip anyway).
5. Scroll down and click **Commit changes** to finish the upload.

That's it — your code is now on GitHub, and Netlify can read it from there.

---

## Step 3 — Deploy it on Netlify

1. Go to [netlify.com](https://netlify.com) and log in.
2. Click **Add new site** → **Import an existing project**.
3. Choose **GitHub**, and pick the `clock-app` repository you just created.
4. Netlify will try to auto-detect the settings — it should recognize this
   as a Next.js app automatically. If it asks for a build command, use
   `npm run build`.
5. Before clicking deploy, look for **"Add environment variables"** (or go
   to **Site settings → Environment variables** after the first deploy) and
   add these two, using the values you copied from Supabase in Step 1:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |

6. Click **Deploy**. After a minute or two, Netlify will give you a web
   address (something like `clock-app-xyz.netlify.app`) — that's your app.

   This project includes a file called `netlify.toml` that tells Netlify
   exactly how to build a Next.js app (including the admin page and the
   PIN-checking logic, which need a bit more than a plain static site).
   Netlify should pick this up automatically — you shouldn't need to
   change any build settings by hand.

---

## Troubleshooting: "Page not found" on your Netlify URL

This almost always means Netlify built the site without realizing it needs
to run as a full Next.js app (rather than a simple static page), so it
served the wrong thing.

1. Make sure the `netlify.toml` file from this project actually made it
   into your GitHub repo — go to your repo on GitHub and check there's a
   file called `netlify.toml` sitting at the top level, next to
   `package.json`. If it's missing, upload it the same way you uploaded
   everything else in Step 2, then Netlify will redeploy automatically.
2. In Netlify, go to **Site configuration → Build & deploy → Build
   settings** and confirm:
   - **Build command**: `npm run build`
   - There's no need to set a publish directory by hand — the
     `netlify.toml` file handles that.
3. Trigger a fresh deploy: in Netlify, go to **Deploys** tab → **Trigger
   deploy** → **Clear cache and deploy site**. This forces it to rebuild
   from scratch rather than reusing a broken previous build.
4. Open the deploy log (click on the deploy in the **Deploys** tab) and
   check near the top for a line mentioning **"Next.js Runtime"** — if you
   see that, the right plugin is active. If you don't see it at all, send
   me a copy of the deploy log and I'll pinpoint it from there.

---

## Step 4 — Create your first login

The app starts with no one able to log in, so you need to create one admin
account directly. The easiest way, with no coding:

1. In Supabase, go to the **Table Editor** → `employees` table.
2. Click **Insert row** and fill in:
   - `name`: your name
   - `is_admin`: turn this **on**
   - `active`: turn this **on**
   - `pin_hash`: this one's the tricky part — it can't just be your PIN
     typed in plain. See the note below.

**Easier option — ask me.** Tell me what PIN you want to use, and I'll
generate the correct `pin_hash` value for you to paste into that field, or
I can do this step for you if you'd rather not handle Supabase directly.

> **Your admin login is ready to go.** For PIN `1870`, paste this exact
> value into the `pin_hash` field:
>
> ```
> $2b$10$vonxQ/BMTZ0TiaREjr.B/.C6Xg0Lqrym4Igb50pPo1uOXf0Upbiay
> ```
>
> So your first row in the `employees` table should be:
> - `name`: your name
> - `pin_hash`: the value above
> - `is_admin`: on
> - `active`: on
>
> Leave `company_id` blank — that's fine for an admin account.

Once that row exists, go to your live Netlify address, click **Admin**, and
log in with that PIN. From there, add the rest of your team through the
**Team** tab in the app itself — no more database editing needed after this
one-time step.

---

## Using the app day to day

- **Main screen**: shows a live clock. Anyone types their PIN, confirms
  their name, and taps **Clock In** or **Clock Out**.
- **Admin page**: tap **Admin** in the top right, log in with an admin PIN.
  - **Hours tab**: every clock-in and clock-out, with running time for
    anyone still clocked in.
  - **Team tab**: add new people (name + PIN + which company + whether
    they're an admin), or deactivate someone who's left — this disables
    their PIN without deleting their past hours.

For a shared device (tablet by the door, a PC at reception), just open your
Netlify address in the browser and leave it on the main screen.

---

## A few things worth knowing

- **PINs are short on purpose** so they're fast to type on a shared
  screen — but that also means anyone who knows a coworker's PIN could
  clock in for them. Normal trade-off for this kind of shared kiosk clock,
  just worth being aware of.
- Each employee can be tagged to one company (Greenland Craftworks ApS,
  Hotel Narsaq ApS, etc.), so the Hours table shows which entity each
  shift belongs to — useful for separating payroll later.
- If anyone ever splits hours across two of your companies in the same
  day, the simplest approach right now is to track them as one person and
  split the hours manually at payroll time. Let me know if you actually
  need it to handle that automatically — that's a bigger change I didn't
  want to over-build without you asking.
- There's no limit yet on how many wrong PINs someone can try in a row.
  Fine for a device on your own premises; if this ever needs to be safely
  usable from anywhere on the internet, tell me and I'll add that.

---

## Multi-company clock-in

Some employees work for more than one of your companies. For them, you can
assign two or more companies in the **Team tab** (click **Companies** next
to their name, or check multiple boxes when adding them) — when they clock
in, they'll get a quick extra screen asking which company that shift is
for. Employees with only one company (or none) see no extra screen at all,
exactly as before.

**If your database already has data in it** (i.e. you set this up before
this feature existed), you need to run one migration once:

1. Open `supabase-migration-multicompany.sql` from this project.
2. Copy everything in it into your Supabase **SQL Editor** and click **Run**.
3. This adds the new tables/columns needed and automatically carries over
   any existing single-company assignments — nothing else changes for staff
   who only work one company.

If you're setting this up fresh (new Supabase project, nothing in it yet),
you don't need the migration file — `supabase-schema.sql` already includes
everything.

## If you ever want to make changes to the code

You don't need to touch GitHub or Netlify settings again for normal use —
only if the app's code itself needs to change (new feature, design tweak,
etc.). In that case, come back to me, I'll make the change, and you'd
re-upload the updated files to GitHub the same way as Step 2 — Netlify
will automatically redeploy when it sees the update.

When I make a change, I'll always tell you exactly which file(s) changed so
you only need to re-upload those, not the whole project.
