# Demo content

Documents, not code: what the demo agents are asked to do, what they operate, and the policies they are checked against. Written before kickoff so the build days are spent building.

| File | What it holds |
|---|---|
| [tasks.md](tasks.md) | The twelve demo runs: instructions, seeded failures, expected verdicts, regression pairs, how runs are labelled |
| [surfaces.md](surfaces.md) | Acme CRM and Meridian ERP: the screens, traps, fault switches and seed data the tasks need |
| [policies/crm-policy.md](policies/crm-policy.md) | POL-CRM-001, one page, six rules. Rendered to PDF and uploaded in the demo |
| [policies/crm-policy.expected.md](policies/crm-policy.expected.md) | The `Rule[]` the compiler must produce from it |
| [policies/erp-policy.md](policies/erp-policy.md) | POL-ERP-001, with one deliberately vague clause |
| [policies/erp-policy.expected.md](policies/erp-policy.expected.md) | Expected `Rule[]`, including the `needs_clarification` case and its sign-off |

All companies, people and numbers are fictional. The card number is a published payment-processor test number, and the tax ID uses area 000, which is never issued.
