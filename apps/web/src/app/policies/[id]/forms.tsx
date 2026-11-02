"use client";
import { useActionState } from "react";
import { type ActionState, resolvePolicyRule, signOffPolicy } from "@/lib/actions";

const EXAMPLE: Record<string, string> = {
  loop_limit: '{"maxRepeats": 2}',
  max_duration: '{"maxMs": 600000}',
  app_allowlist: '{"apps": ["Acme CRM"]}',
  confirm_before_destroy: '{"targets": ["delete"], "dialogWithinMs": 3000}',
  data_class_ban: '{"classes": ["payment_card"]}',
};

export function ResolveForm({
  policyId,
  ruleId,
  type,
}: {
  policyId: string;
  ruleId: string;
  type: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resolvePolicyRule, {
    error: null,
  });
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <input type="hidden" name="policyId" value={policyId} />
      <input type="hidden" name="ruleId" value={ruleId} />
      <div className="field">
        <label htmlFor={`p-${ruleId}`}>Parameters</label>
        <input
          id={`p-${ruleId}`}
          name="params"
          className="input mono"
          defaultValue={EXAMPLE[type] ?? "{}"}
        />
      </div>
      <div className="field">
        <label htmlFor={`r-${ruleId}`}>Read-back</label>
        <input
          id={`r-${ruleId}`}
          name="readBack"
          className="input"
          placeholder="Resubmitting the same entry more than twice is a violation."
        />
      </div>
      {state.error ? (
        <p className="notice notice-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Resolve rule"}
        </button>
      </div>
    </form>
  );
}

export function SignOffForm({ policyId, disabled }: { policyId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signOffPolicy, {
    error: null,
  });
  return (
    <form action={action} className="row">
      <input type="hidden" name="policyId" value={policyId} />
      <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
        {pending ? "Signing off…" : "Sign off all rules"}
      </button>
      {state.error ? (
        <span className="notice notice-err" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
