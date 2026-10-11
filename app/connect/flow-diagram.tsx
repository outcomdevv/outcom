"use client";

import { SheetIcon } from "@/app/connect/icons";
import type { FlowNode } from "@/lib/suggested-checks";

type Props = {
  flow: FlowNode[];
  /** The step Tell Outcom connects from (the last step that writes the business data). */
  connectFrom: string | null;
};

const Dot = ({ node }: { node: FlowNode }) =>
  node.type === "googleSheets" ? <SheetIcon size={16} /> : <i className={`cx-fdot ${node.kind}`} aria-hidden />;

/** Draws the user's own workflow and shows exactly where the new “Tell Outcom” step attaches. */
export default function FlowDiagram({ flow, connectFrom }: Props) {
  return (
    <div className="cx-fd" role="img" aria-label={`Your workflow. Connect Tell Outcom from ${connectFrom ?? "the step that saves your data"}.`}>
      {flow.map((n, i) => {
        const hot = n.name === connectFrom;
        return (
          <div key={n.name + i} className="cx-fd-item">
            {i > 0 && <span className="cx-fd-arrow" aria-hidden>→</span>}
            <div className={`cx-fnode ${hot ? "hot" : n.kind === "message" ? "soft" : ""}`}>
              <span className="cx-fchip"><Dot node={n} />{n.name}</span>
              {hot && <>
                <span className="cx-fbranch" aria-hidden />
                <span className="cx-fchip cx-fnew">+ Tell Outcom</span>
                <small>connect it here</small>
              </>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
