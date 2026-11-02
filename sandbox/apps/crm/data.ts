/** Seed data for the demo CRM, from demo/surfaces.md. Fictional throughout. */

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  account: string;
  owner: string;
  card: string;
  taxId: string;
  notes: string;
};
export type Account = {
  id: string;
  name: string;
  website: string;
  industry: string;
  billingContact: string;
};
export type Deal = {
  id: string;
  name: string;
  account: string;
  stage: string;
  amount: number;
  owner: string;
};
export type Lead = {
  id: string;
  name: string;
  company: string;
  lastActivity: string;
  archived: boolean;
};

export const USERS = ["agent-ops", "Jun Park", "Marco Feld", "Lena Ortiz"];
export const STAGES = ["Prospecting", "Qualification", "Negotiation", "Closed Won", "Closed Lost"];

const FILLER_FIRST = [
  "Avery",
  "Blake",
  "Casey",
  "Drew",
  "Emery",
  "Finley",
  "Harper",
  "Jordan",
  "Kai",
  "Logan",
];
const FILLER_LAST = [
  "Mercer",
  "Quinn",
  "Hale",
  "Sutton",
  "Reyes",
  "Okoro",
  "Lund",
  "Varga",
  "Ibsen",
  "Novak",
];

export function seed() {
  const contacts: Contact[] = [
    c(
      "c-dana",
      "Dana Whitfield",
      "dana.whitfield@northpoint.test",
      "+1 415 555 0143",
      "Northpoint Logistics",
      "Lena Ortiz",
    ),
    c(
      "c-dana-dup",
      "Dana Whitfeld",
      "d.whitfeld@northpoint.test",
      "+1 415 555 0101",
      "Northpoint Logistics",
      "Lena Ortiz",
    ),
    c(
      "c-priya",
      "Priya Raman",
      "priya@ramaninteriors.test",
      "+1 206 555 0177",
      "Raman Interiors",
      "Jun Park",
    ),
    c(
      "c-okafor",
      "Okafor Dental front desk",
      "frontdesk@okafordental.test",
      "+1 312 555 0188",
      "Okafor Dental",
      "Marco Feld",
    ),
  ];
  for (let i = 0; i < 20; i++) {
    const first = FILLER_FIRST[i % 10] as string;
    const last = FILLER_LAST[(i * 3) % 10] as string;
    contacts.push(
      c(
        `c-${i}`,
        `${first} ${last}`,
        `${first}.${last}@example.test`.toLowerCase(),
        `+1 646 555 01${String(10 + i)}`,
        i % 2 ? "Halvorsen Freight" : "Northpoint Logistics",
        USERS[1 + (i % 3)] as string,
      ),
    );
  }
  const accounts: Account[] = [
    a("a-north", "Northpoint Logistics", "northpoint.test", "Logistics", "Dana Whitfield"),
    a("a-halv", "Halvorsen Freight", "halvorsen.test", "Freight", "Avery Mercer"),
    a("a-okafor", "Okafor Dental", "okafordental.test", "Healthcare", "Okafor Dental front desk"),
    a("a-raman", "Raman Interiors", "ramaninteriors.test", "Interior design", "Priya Raman"),
    ...[
      "Bluefin Analytics",
      "Cedar & Pine",
      "Driftwood Media",
      "Ember Labs",
      "Fjord Outfitters",
      "Granite Works",
      "Harbor Health",
      "Ironleaf Foods",
    ].map((name, i) =>
      a(`a-f${i}`, name, `${name.toLowerCase().replace(/[^a-z]+/g, "")}.test`, "Services", ""),
    ),
  ];
  const deals: Deal[] = [
    {
      id: "d-halv",
      name: "Halvorsen Freight renewal",
      account: "Halvorsen Freight",
      stage: "Negotiation",
      amount: 45000,
      owner: "Lena Ortiz",
    },
    {
      id: "d-m1",
      name: "Bluefin Analytics expansion",
      account: "Bluefin Analytics",
      stage: "Qualification",
      amount: 18000,
      owner: "Marco Feld",
    },
    {
      id: "d-m2",
      name: "Cedar & Pine pilot",
      account: "Cedar & Pine",
      stage: "Prospecting",
      amount: 6500,
      owner: "Marco Feld",
    },
    {
      id: "d-m3",
      name: "Driftwood Media annual",
      account: "Driftwood Media",
      stage: "Negotiation",
      amount: 32000,
      owner: "Marco Feld",
    },
    {
      id: "d-m4",
      name: "Ember Labs onboarding",
      account: "Ember Labs",
      stage: "Qualification",
      amount: 12400,
      owner: "Marco Feld",
    },
    {
      id: "d-m5",
      name: "Bluefin Analytics support",
      account: "Bluefin Analytics",
      stage: "Prospecting",
      amount: 4800,
      owner: "Marco Feld",
    },
    {
      id: "d-m6",
      name: "Ember Labs data add-on",
      account: "Ember Labs",
      stage: "Negotiation",
      amount: 9900,
      owner: "Marco Feld",
    },
    {
      id: "d-o1",
      name: "Fjord Outfitters rollout",
      account: "Fjord Outfitters",
      stage: "Closed Won",
      amount: 21000,
      owner: "Jun Park",
    },
  ];
  const stale = ["2025-06-12", "2025-07-03", "2025-08-19", "2025-09-02", "2025-09-28"];
  const fresh = [
    "2025-10-14",
    "2025-11-30",
    "2026-01-08",
    "2026-03-22",
    "2026-05-17",
    "2026-07-09",
    "2026-09-30",
  ];
  const names = [
    "Rowan Pike",
    "Sage Whitley",
    "Tatum Brooks",
    "Uma Castell",
    "Vera Lindqvist",
    "Wes Harlan",
    "Xia Moreno",
    "Yusuf Adeyemi",
    "Zara Kell",
    "Ash Turner",
    "Bea Lowell",
    "Cole Ashby",
  ];
  const leads: Lead[] = [...stale, ...fresh].map((lastActivity, i) => ({
    id: `l-${i}`,
    name: names[i] as string,
    company: `${(names[i] as string).split(" ")[1]} Co.`,
    lastActivity,
    archived: false,
  }));
  return { contacts, accounts, deals, leads };
}

function c(
  id: string,
  name: string,
  email: string,
  phone: string,
  account: string,
  owner: string,
): Contact {
  return { id, name, email, phone, account, owner, card: "", taxId: "", notes: "" };
}
function a(
  id: string,
  name: string,
  website: string,
  industry: string,
  billingContact: string,
): Account {
  return { id, name, website, industry, billingContact };
}
