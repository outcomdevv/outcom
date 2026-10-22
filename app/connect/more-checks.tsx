"use client";
import { useState } from "react";
import { COUNT_OPERATORS, type CountOperator } from "@/lib/connect-checks";
import { CHECK_TEMPLATES } from "@/lib/check-templates";

type Props = {
  system: string;
  disabled?: boolean;
  onRequired: (fields: string) => void;
  onCount: (op: CountOperator, n: number) => void;
  onFresh: (field: string, minutes: number) => void;
  onTemplate: (id: string) => void;
};

/** Checks for the silent failures that leave no failed run behind: empty fields, duplicates, late writes. */
export default function MoreChecks({ system, disabled, onRequired, onCount, onFresh, onTemplate }: Props) {
  const [fields, setFields] = useState("");
  const [op, setOp] = useState<CountOperator>("equals");
  const [n, setN] = useState("1");
  const [freshField, setFreshField] = useState("");
  const [minutes, setMinutes] = useState("10");
  const reported = system === "reported";

  return (
    <div className="cx-card cx-build">
      <h3>Catch silent failures</h3>
      <p className="cx-muted">Start from a common workflow, or add one of the checks below.</p>
      <div className="cx-options">
        {CHECK_TEMPLATES.map(t => (
          <button type="button" key={t.id} className="cx-option" disabled={disabled} onClick={() => onTemplate(t.id)}>
            <span><b>{t.title}</b><small>{t.text}</small></span><i>+</i>
          </button>
        ))}
      </div>

      <div className="cx-row">
        <input autoComplete="off" value={fields} onChange={e => setFields(e.target.value)} placeholder="Fields that must be filled · e.g. email, owner" />
        <button type="button" className="simple-secondary" disabled={disabled || !fields.trim()} onClick={() => { onRequired(fields); setFields(""); }}>Add “fields filled in”</button>
      </div>

      <div className="cx-row cx-three">
        <select value={op} onChange={e => setOp(e.target.value as CountOperator)}>{COUNT_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
        <input inputMode="numeric" value={n} onChange={e => setN(e.target.value)} aria-label="Number of records" />
        <button type="button" className="simple-secondary" disabled={disabled || !reported} onClick={() => onCount(op, Number(n))}>Add “number of records”</button>
      </div>
      {!reported && <p className="cx-muted">Counting records (to catch duplicates) works with “Any other app”: the read-back step sends how many it found.</p>}

      <div className="cx-row cx-three">
        <input autoComplete="off" value={freshField} onChange={e => setFreshField(e.target.value)} placeholder="Date field · e.g. created_at" />
        <input inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} aria-label="Minutes" />
        <button type="button" className="simple-secondary" disabled={disabled || !freshField.trim()} onClick={() => { onFresh(freshField, Number(minutes)); setFreshField(""); }}>Add “written within … min”</button>
      </div>
    </div>
  );
}
