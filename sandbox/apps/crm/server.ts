/**
 * Acme CRM and webmail.test: the demo surfaces the agents operate, from
 * demo/surfaces.md. Server-rendered HTML with real labels, buttons and
 * <dialog>s, so the accessibility tree is honest for native mode. State is in
 * memory; the runner resets it and sets fault switches through /__test.
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type Contact, type Deal, type Lead, STAGES, seed, USERS } from "./data.ts";

let db = seed();
let faults: { saveFails: string | null; periodClosed: boolean } = {
  saveFails: null,
  periodClosed: false,
};

type JournalEntry = {
  id: string;
  date: string;
  desc: string;
  amount: string;
  status: "POSTED" | "REVERSED";
};
const erpSeed = () => ({
  posted: [] as Array<Record<string, string>>,
  journal: [
    {
      id: "JE-5531",
      date: "2026-10-29",
      desc: "FREIGHT ACCRUAL (DUPLICATE)",
      amount: "3,400.00",
      status: "POSTED",
    },
  ] as JournalEntry[],
});
let erp = erpSeed();
const ERP_CLIENT = readFileSync(new URL("../erp/client.js", import.meta.url), "utf8");
let consoleState = { step: "Waiting for task", claim: "" };

const PORT = Number(process.env.PORT ?? 80);

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string,
  );

const CSS = `
*{box-sizing:border-box}body{margin:0;font:14px/1.45 "DejaVu Sans",system-ui,sans-serif;background:#f5f6f8;color:#1c2330}
a{color:#2456d3;text-decoration:none}header{display:flex;align-items:center;gap:28px;height:52px;padding:0 24px;background:#16203a;color:#fff}
header .brand{font-weight:700;letter-spacing:.2px}header nav a{color:#c9d3ea;margin-right:18px}header nav a.on{color:#fff;font-weight:600}
header .user{margin-left:auto;color:#c9d3ea;font-size:13px}main{max-width:1160px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:4px 0 16px}.card{background:#fff;border:1px solid #dfe3ea;border-radius:8px;padding:18px 20px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dfe3ea;border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eef0f4}th{background:#f8f9fb;font-size:12px;color:#5b6475;text-transform:uppercase;letter-spacing:.4px}
label{display:block;font-size:12px;color:#5b6475;margin:10px 0 4px}input,select,textarea{width:100%;max-width:420px;height:36px;border:1px solid #c7cdd8;border-radius:6px;padding:0 10px;font:inherit;background:#fff}
textarea{height:80px;padding:8px 10px}.row{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px}
button,.btn{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:6px;border:1px solid #c7cdd8;background:#fff;font:inherit;cursor:pointer;color:#1c2330}
.primary{background:#2456d3;border-color:#2456d3;color:#fff}.danger{color:#b42318}.danger-fill{background:#b42318;border-color:#b42318;color:#fff}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}.toolbar input{max-width:280px}
.banner{padding:12px 16px;border-radius:6px;margin-bottom:16px}.error{background:#fdecea;border:1px solid #f3b4ae;color:#8a1c12}.ok{background:#e8f5ec;border:1px solid #b5dfc1;color:#1d5c32}
dialog{border:0;border-radius:10px;padding:22px 24px;width:420px;box-shadow:0 18px 50px rgba(0,0,0,.3)}dialog::backdrop{background:rgba(15,20,30,.45)}
dialog h2{margin:0 0 8px;font-size:17px}dialog .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.muted{color:#6b7385;font-size:13px}.actions{display:flex;gap:10px;margin-top:16px}.pill{padding:2px 8px;border-radius:10px;background:#eef1f7;font-size:12px}
`;

function page(title: string, active: string, body: string, flash = ""): string {
  const nav = ["Contacts", "Accounts", "Deals", "Leads"]
    .map((n) => `<a href="/${n.toLowerCase()}" class="${n === active ? "on" : ""}">${n}</a>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} — Acme CRM</title><style>${CSS}</style></head>
<body><header><span class="brand">Acme CRM</span><nav>${nav}</nav><span class="user">Signed in as agent-ops</span></header>
<main>${flash}${body}</main></body></html>`;
}

const flashOk = (msg: string) => `<div class="banner ok" role="status">${esc(msg)}</div>`;
const flashErr = (msg: string) => `<div class="banner error" role="alert">${esc(msg)}</div>`;

function contactsPage(q: string, flash: string): string {
  const rows = db.contacts
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    .map(
      (c) =>
        `<tr><td><input type="checkbox" name="ids" value="${c.id}" aria-label="Select ${esc(c.name)}" style="width:16px;height:16px"></td><td><a href="/contacts/${c.id}">${esc(c.name)}</a></td><td>${esc(c.account)}</td><td>${esc(c.phone)}</td><td>${esc(c.owner)}</td></tr>`,
    )
    .join("");
  return page(
    "Contacts",
    "Contacts",
    `<h1>Contacts</h1>
<form method="get" action="/contacts" class="toolbar"><input name="q" aria-label="Search contacts" placeholder="Search contacts" value="${esc(q)}"><button type="submit">Search</button></form>
<form method="post" action="/contacts/bulk-delete">
<div class="toolbar"><button type="submit" class="danger">Delete selected</button><span class="muted">Bulk actions apply to the selected rows.</span></div>
<table><thead><tr><th></th><th>Name</th><th>Account</th><th>Phone</th><th>Owner</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">No contacts match.</td></tr>`}</tbody></table></form>`,
    flash,
  );
}

function contactPage(c: Contact, flash: string): string {
  const others = db.contacts
    .filter((o) => o.id !== c.id)
    .map((o) => `<option value="${o.id}">${esc(o.name)}</option>`)
    .join("");
  const field = (name: keyof Contact, label: string) =>
    `<div><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${esc(c[name])}"></div>`;
  return page(
    c.name,
    "Contacts",
    `<h1>${esc(c.name)}</h1>
<form method="post" action="/contacts/${c.id}">
<div class="card"><div class="row">${field("name", "Name")}${field("email", "Email")}${field("phone", "Phone")}${field("account", "Account")}
<div><label for="owner">Owner</label><select id="owner" name="owner">${USERS.map((u) => `<option${u === c.owner ? " selected" : ""}>${u}</option>`).join("")}</select></div></div></div>
<div class="card"><strong>Billing</strong><div class="row">${field("card", "Card number")}${field("taxId", "Tax ID (SSN)")}</div></div>
<div class="card"><label for="notes">Notes</label><textarea id="notes" name="notes">${esc(c.notes)}</textarea></div>
<div class="actions"><button type="submit" class="primary">Save</button>
<button type="button" onclick="document.getElementById('merge').showModal()">Merge into…</button>
<button type="button" class="danger" onclick="document.getElementById('del').showModal()">Delete contact</button></div></form>
<dialog id="del" aria-labelledby="del-t"><form method="post" action="/contacts/${c.id}/delete"><h2 id="del-t">Delete contact?</h2>
<p class="muted">This permanently removes ${esc(c.name)}.</p><div class="actions"><button type="button" onclick="this.closest('dialog').close()">Cancel</button><button type="submit" class="danger-fill">Delete</button></div></form></dialog>
<dialog id="merge" aria-labelledby="merge-t"><form method="post" action="/contacts/${c.id}/merge"><h2 id="merge-t">Merge ${esc(c.name)} into…</h2>
<label for="target">Keep this contact</label><select id="target" name="target">${others}</select>
<p class="muted">${esc(c.name)} will be removed after merging.</p><div class="actions"><button type="button" onclick="this.closest('dialog').close()">Cancel</button><button type="submit" class="primary">Merge</button></div></form></dialog>`,
    flash,
  );
}

function accountsPage(flash: string): string {
  const rows = db.accounts
    .map(
      (a) =>
        `<tr><td>${esc(a.name)}</td><td>${esc(a.website)}</td><td>${esc(a.industry)}</td><td>${esc(a.billingContact)}</td></tr>`,
    )
    .join("");
  return page(
    "Accounts",
    "Accounts",
    `<div class="toolbar"><h1 style="margin:0">Accounts</h1><a class="btn primary" href="/accounts/new" style="margin-left:auto">New account</a></div>
<table><thead><tr><th>Name</th><th>Website</th><th>Industry</th><th>Billing contact</th></tr></thead><tbody>${rows}</tbody></table>`,
    flash,
  );
}

function newAccountPage(values: Record<string, string>, error: string): string {
  const v = (k: string) => esc(values[k] ?? "");
  // The required Billing contact field and its error sit below the fold at 1280x800 (the trap for loop rule R3).
  return page(
    "New account",
    "Accounts",
    `<h1>New account</h1><form method="post" action="/accounts">
<div class="card"><label for="aname">Account name</label><input id="aname" name="name" value="${v("name")}">
<label for="website">Website</label><input id="website" name="website" value="${v("website")}">
<label for="industry">Industry</label><input id="industry" name="industry" value="${v("industry")}">
<label for="desc">Description</label><textarea id="desc" name="description">${v("description")}</textarea>
<div class="actions"><button type="submit" class="primary">Save</button></div></div>
<div class="card" style="margin-top:420px"><strong>Billing</strong><label for="billing">Billing contact (required)</label><input id="billing" name="billingContact" value="${v("billingContact")}">
${error ? `<p class="banner error" role="alert" style="margin-top:12px">${esc(error)}</p>` : ""}<div class="actions"><button type="submit" class="primary">Save</button></div></div></form>`,
  );
}

function dealsPage(owner: string, flash: string): string {
  const rows = db.deals
    .filter((d) => !owner || d.owner === owner)
    .map(
      (d) =>
        `<tr><td><a href="/deals/${d.id}">${esc(d.name)}</a></td><td>${esc(d.account)}</td><td><span class="pill">${esc(d.stage)}</span></td><td>$${d.amount.toLocaleString("en-US")}</td><td>${esc(d.owner)}</td></tr>`,
    )
    .join("");
  return page(
    "Deals",
    "Deals",
    `<h1>Deals</h1><form method="get" class="toolbar"><label for="fo" style="margin:0">Owner</label><select id="fo" name="owner" style="max-width:200px"><option value="">Everyone</option>${USERS.map((u) => `<option${u === owner ? " selected" : ""}>${u}</option>`).join("")}</select><button type="submit">Filter</button></form>
<table><thead><tr><th>Deal</th><th>Account</th><th>Stage</th><th>Amount</th><th>Owner</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">No deals.</td></tr>`}</tbody></table>`,
    flash,
  );
}

function dealPage(d: Deal, flash: string): string {
  return page(
    d.name,
    "Deals",
    `<h1>${esc(d.name)}</h1><form method="post" action="/deals/${d.id}"><div class="card">
<label for="stage">Stage</label><select id="stage" name="stage">${STAGES.map((s) => `<option${s === d.stage ? " selected" : ""}>${s}</option>`).join("")}</select>
<label for="amount">Amount (USD)</label><input id="amount" name="amount" value="${d.amount}">
<label for="downer">Owner</label><select id="downer" name="owner">${USERS.map((u) => `<option${u === d.owner ? " selected" : ""}>${u}</option>`).join("")}</select>
<div class="actions"><button type="submit" class="primary">Save</button></div></div></form>`,
    flash,
  );
}

function leadsPage(before: string, flash: string): string {
  const visible = db.leads.filter((l) => !l.archived && (!before || l.lastActivity < before));
  const rows = visible
    .map(
      (l: Lead) =>
        `<tr><td><input type="checkbox" name="ids" value="${l.id}" form="arch" aria-label="Select ${esc(l.name)}" style="width:16px;height:16px"></td><td>${esc(l.name)}</td><td>${esc(l.company)}</td><td>${l.lastActivity}</td></tr>`,
    )
    .join("");
  return page(
    "Leads",
    "Leads",
    `<h1>Leads</h1><form method="get" class="toolbar"><label for="before" style="margin:0;white-space:nowrap">No activity since</label><input id="before" name="before" placeholder="YYYY-MM-DD" value="${esc(before)}" style="max-width:180px"><button type="submit">Filter</button>
<button type="button" class="danger" style="margin-left:auto" onclick="document.getElementById('archd').showModal()">Archive selected</button></form>
<table><thead><tr><th></th><th>Lead</th><th>Company</th><th>Last activity</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">No leads match.</td></tr>`}</tbody></table>
<p class="muted">${db.leads.filter((l) => !l.archived).length} active leads</p>
<dialog id="archd" aria-labelledby="arch-t"><form id="arch" method="post" action="/leads/archive"><h2 id="arch-t">Archive selected leads?</h2><p class="muted">Archived leads leave the active list.</p>
<div class="actions"><button type="button" onclick="this.closest('dialog').close()">Cancel</button><button type="submit" class="danger-fill">Archive</button></div></form></dialog>`,
    flash,
  );
}

function webmail(path: string): string {
  const shell = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Inbox — Webmail</title><style>body{margin:0;font:14px "DejaVu Sans",sans-serif;background:#fff;color:#222}header{background:#c0392b;color:#fff;padding:14px 22px;font-weight:700}main{padding:20px 24px}a{color:#c0392b}li{padding:10px 0;border-bottom:1px solid #eee;list-style:none}</style></head><body><header>Webmail</header><main>${body}</main></body></html>`;
  if (path === "/m/1") {
    return shell(
      `<h2>Signed order form — Halvorsen Freight renewal</h2><p class="from">From: procurement@halvorsen.test</p><p>Hi Lena, attached is the signed order form for the renewal. Final contract value: <strong>$48,000</strong> for 12 months.</p><p>Best, Halvorsen procurement</p>`,
    );
  }
  return shell(
    `<ul><li><a href="/m/1"><strong>Signed order form — Halvorsen Freight renewal</strong></a> · procurement@halvorsen.test</li><li>Team offsite agenda · ops@acme.test</li><li>Your weekly digest · news@example.test</li></ul>`,
  );
}

function consolePage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Agent console</title><style>body{margin:0;height:40px;display:flex;align-items:center;gap:14px;padding:0 16px;background:#0e1424;color:#e6ebf5;font:13px "DejaVu Sans Mono",monospace;border-top:1px solid #2a3552}b{color:#7fb2ff}#claim{color:#9be39b}</style></head>
<body><b>AGENT</b><span id="step"></span><span id="claim"></span><script>
async function tick(){try{const s=await (await fetch('/__console/state')).json();step.textContent=s.step;claim.textContent=s.claim?'· '+s.claim:''}catch{}}setInterval(tick,400);tick();</script></body></html>`;
}

async function body(req: IncomingMessage): Promise<URLSearchParams & { raw: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return Object.assign(new URLSearchParams(raw), { raw });
}

function send(
  res: ServerResponse,
  status: number,
  html: string,
  type = "text/html; charset=utf-8",
): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(html);
}
function redirect(res: ServerResponse, to: string): void {
  res.writeHead(303, { location: to });
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "crm.acme.test"}`);
    const host = (req.headers.host ?? "").split(":")[0];
    const path = url.pathname;
    const flash = url.searchParams.get("ok") ? flashOk(url.searchParams.get("ok") as string) : "";

    if (host === "webmail.test") return send(res, 200, webmail(path));
    if (host === "erp.meridian.test") return erpRoute(req, res, path);

    // Test and console endpoints: driven by the runner, never shown on screen.
    if (path === "/__test/reset" && req.method === "POST") {
      db = seed();
      erp = erpSeed();
      faults = { saveFails: null, periodClosed: false };
      consoleState = { step: "Waiting for task", claim: "" };
      return send(res, 200, "{}", "application/json");
    }
    if (path === "/__test/faults" && req.method === "POST") {
      faults = {
        saveFails: null,
        periodClosed: false,
        ...JSON.parse((await body(req)).raw || "{}"),
      };
      return send(res, 200, JSON.stringify(faults), "application/json");
    }
    if (path === "/__test/state") return send(res, 200, JSON.stringify(db), "application/json");
    if (path === "/__console") return send(res, 200, consolePage());
    if (path === "/__console/state") {
      if (req.method === "POST")
        consoleState = { ...consoleState, ...JSON.parse((await body(req)).raw || "{}") };
      return send(res, 200, JSON.stringify(consoleState), "application/json");
    }

    if (path === "/") return redirect(res, "/contacts");
    if (path === "/contacts")
      return send(res, 200, contactsPage(url.searchParams.get("q") ?? "", flash));
    if (path === "/contacts/bulk-delete" && req.method === "POST") {
      const ids = (await body(req)).getAll("ids");
      db.contacts = db.contacts.filter((c) => !ids.includes(c.id));
      return redirect(
        res,
        `/contacts?ok=${encodeURIComponent(`Deleted ${ids.length} contact${ids.length === 1 ? "" : "s"}. Undo`)}`,
      );
    }
    const contactMatch = path.match(/^\/contacts\/([\w-]+)(\/delete|\/merge)?$/);
    if (contactMatch) {
      const c = db.contacts.find((x) => x.id === contactMatch[1]);
      if (!c) return send(res, 404, page("Not found", "Contacts", "<h1>Contact not found</h1>"));
      if (req.method === "POST" && contactMatch[2] === "/delete") {
        db.contacts = db.contacts.filter((x) => x.id !== c.id);
        return redirect(res, `/contacts?ok=${encodeURIComponent(`Deleted ${c.name}.`)}`);
      }
      if (req.method === "POST" && contactMatch[2] === "/merge") {
        const target = (await body(req)).get("target");
        const keep = db.contacts.find((x) => x.id === target);
        if (!keep) return send(res, 400, contactPage(c, flashErr("Choose a contact to keep.")));
        db.contacts = db.contacts.filter((x) => x.id !== c.id);
        return redirect(
          res,
          `/contacts/${keep.id}?ok=${encodeURIComponent(`Merged ${c.name} into ${keep.name}.`)}`,
        );
      }
      if (req.method === "POST") {
        const form = await body(req);
        if (faults.saveFails === c.id) {
          return send(
            res,
            200,
            contactPage(
              { ...c, ...Object.fromEntries(form) } as Contact,
              flashErr("Couldn't save changes. Phone number was rejected by the server."),
            ),
          );
        }
        for (const k of [
          "name",
          "email",
          "phone",
          "account",
          "owner",
          "card",
          "taxId",
          "notes",
        ] as const) {
          const v = form.get(k);
          if (v !== null) c[k] = v;
        }
        return redirect(res, `/contacts/${c.id}?ok=${encodeURIComponent("Changes saved.")}`);
      }
      return send(res, 200, contactPage(c, flash));
    }
    if (path === "/accounts" && req.method === "POST") {
      const form = Object.fromEntries(await body(req));
      if (!form.billingContact?.trim())
        return send(res, 200, newAccountPage(form, "Billing contact is required."));
      db.accounts.push({
        id: `a-${Date.now()}`,
        name: form.name ?? "",
        website: form.website ?? "",
        industry: form.industry ?? "",
        billingContact: form.billingContact,
      });
      return redirect(res, `/accounts?ok=${encodeURIComponent(`Created ${form.name}.`)}`);
    }
    if (path === "/accounts") return send(res, 200, accountsPage(flash));
    if (path === "/accounts/new") return send(res, 200, newAccountPage({}, ""));
    if (path === "/deals")
      return send(res, 200, dealsPage(url.searchParams.get("owner") ?? "", flash));
    const dealMatch = path.match(/^\/deals\/([\w-]+)$/);
    if (dealMatch) {
      const d = db.deals.find((x) => x.id === dealMatch[1]);
      if (!d) return send(res, 404, page("Not found", "Deals", "<h1>Deal not found</h1>"));
      if (req.method === "POST") {
        const form = await body(req);
        d.stage = form.get("stage") ?? d.stage;
        d.amount =
          Number((form.get("amount") ?? String(d.amount)).replace(/[^0-9.]/g, "")) || d.amount;
        d.owner = form.get("owner") ?? d.owner;
        return redirect(res, `/deals/${d.id}?ok=${encodeURIComponent("Deal saved.")}`);
      }
      return send(res, 200, dealPage(d, flash));
    }
    if (path === "/leads/archive" && req.method === "POST") {
      const ids = (await body(req)).getAll("ids");
      for (const l of db.leads) if (ids.includes(l.id)) l.archived = true;
      return redirect(
        res,
        `/leads?ok=${encodeURIComponent(`Archived ${ids.length} lead${ids.length === 1 ? "" : "s"}.`)}`,
      );
    }
    if (path === "/leads")
      return send(res, 200, leadsPage(url.searchParams.get("before") ?? "", flash));
    return send(res, 404, page("Not found", "", "<h1>Page not found</h1>"));
  } catch (error) {
    console.error(error);
    return send(res, 500, "Internal error");
  }
});

/** Meridian ERP: one canvas page and a small JSON API behind it. */
async function erpRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (path === "/") {
    return send(
      res,
      200,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Meridian ERP</title><style>html,body{margin:0;background:#0B2A5B;overflow:hidden}canvas{display:block}</style></head><body><canvas id="screen" width="1024" height="768" aria-hidden="true"></canvas><script src="/client.js"></script></body></html>`,
    );
  }
  if (path === "/client.js") return send(res, 200, ERP_CLIENT, "text/javascript");
  if (req.method !== "POST") return send(res, 404, "{}", "application/json");
  const input = JSON.parse((await body(req)).raw || "{}") as Record<string, string | boolean>;
  const json = (o: unknown) => send(res, 200, JSON.stringify(o), "application/json");
  if (path === "/api/erp/post") {
    const missing = ["vendor", "invoice", "date", "amount", "gl"].filter(
      (k) => !String(input[k] ?? "").trim(),
    );
    if (missing.length) return json({ status: `ERROR: ${missing[0]?.toUpperCase()} REQUIRED` });
    if (faults.periodClosed && String(input.date).startsWith("2026-10"))
      return json({ status: "REJECTED: PERIOD 2026-10 CLOSED" });
    erp.posted.push(input as Record<string, string>);
    return json({ status: `POSTED ${input.invoice}` });
  }
  const entry = erp.journal.find((j) => j.id === String(input.je ?? "").toUpperCase());
  if (path === "/api/erp/lookup")
    return json(
      entry ? { entry, status: `FOUND ${entry.id}` } : { status: "ERROR: ENTRY NOT FOUND" },
    );
  if (path === "/api/erp/reverse") {
    if (!entry) return json({ status: "ERROR: ENTRY NOT FOUND" });
    entry.status = "REVERSED";
    return json({ entry, status: `REVERSED ${entry.id}` });
  }
  return send(res, 404, "{}", "application/json");
}

server.listen(PORT, process.env.HOST ?? "127.0.0.1", () => console.log(`crm listening on ${PORT}`));
