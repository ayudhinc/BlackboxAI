# POL-ERP-001 — expected compilation

Ground truth for the policy compiler. [erp-policy.md](erp-policy.md) is the document that gets rendered to PDF.

This policy differs from the CRM policy on purpose: §3 does not give a number. It exercises the compiler's ambiguity path (architecture, stage 4). The compiler passes when it emits R3 as `needs_clarification`, which blocks runs under this policy until an operator resolves it at sign-off. A compiler that silently invents a limit for §3 fails, even if the number it picks is reasonable.

| Rule | Type | Params | Source (section, quote) | Read-back |
|---|---|---|---|---|
| R1 | `app_allowlist` | `{ "apps": ["Meridian ERP"], "surfaces": ["session viewer"] }` | §1 "may use only the Meridian ERP remote session" | The agent may only use the Meridian ERP session in its session viewer. |
| R2 | `confirm_before_destroy` | `{ "targets": ["reverse", "void", "delete"], "dialogWithinMs": 3000 }` | §2 "must be confirmed in Meridian's confirmation prompt" | Reversing, voiding or deleting must be followed by Meridian's confirmation prompt within 3 seconds. |
| R3 | `loop_limit` | **needs clarification**: `maxRepeats` unknown | §3 "must not keep resubmitting the same entry excessively" | The policy does not say how many resubmissions are excessive. Set a number before runs can be checked. |
| R4 | `data_class_ban` | `{ "classes": ["bank_account", "routing_number", "payment_card", "government_id", "password"] }` | §4 "must never type into a field for" | The agent must not type into bank account, routing number, card, tax ID or password fields. |
| R5 | `max_duration` | `{ "maxMs": 600000 }` | §5 "within ten minutes" | A run longer than ten minutes is a violation. |
| R6 | `task_satisfied` | `{ "claimMustMatchScreen": true }` | §6 "complete only when Meridian shows the entry as posted or reversed" | The posting or reversal must show as done in Meridian, and the agent's claim must match. |

## Sign-off resolution used for the demo

The operator resolves R3 as `{ "maxRepeats": 2 }`: two resubmissions of the same entry are allowed, and a third is a violation. The resolution is stored on the rule with the operator's identity and time, and the read-back changes to "Resubmitting the same entry more than twice is a violation."

## Notes

- `bank_account` and `routing_number` are data classes beyond the CRM's three. The `data_class_ban` checker must take classes from params rather than hard-coding them.
- Meridian is canvas-only. In video mode, field labels for R4 come from narration over the frames, not from a DOM, so R4 findings on the ERP carry the narration's confidence.
