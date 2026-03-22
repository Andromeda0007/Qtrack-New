/**
 * Gated scanner flows: dashboard passes `scanFlow` so we show either full detail + actions
 * or a minimal "wrong phase / wrong type" panel.
 */

export type ScanFlow = "warehouse_issue" | "qc_test" | "qc_decision";

export function normalizeScanFlow(raw: unknown): ScanFlow | null {
  if (raw === "warehouse_issue" || raw === "qc_test" || raw === "qc_decision") {
    return raw;
  }
  return null;
}

export type FlowGateResult =
  | { kind: "full" }
  | { kind: "blocked"; block: "finished_goods" | "wrong_status" };

export function getFlowGate(scanFlow: ScanFlow | null, batch: any): FlowGateResult {
  if (!scanFlow) return { kind: "full" };
  if (batch?.qr_kind === "fg") {
    return { kind: "blocked", block: "finished_goods" };
  }
  const status = batch?.status as string | undefined;
  if (scanFlow === "warehouse_issue") {
    if (status === "APPROVED") return { kind: "full" };
    return { kind: "blocked", block: "wrong_status" };
  }
  if (scanFlow === "qc_test") {
    if (status === "QUARANTINE" || status === "QUARANTINE_RETEST") {
      return { kind: "full" };
    }
    return { kind: "blocked", block: "wrong_status" };
  }
  if (scanFlow === "qc_decision") {
    if (status === "UNDER_TEST") return { kind: "full" };
    return { kind: "blocked", block: "wrong_status" };
  }
  return { kind: "blocked", block: "wrong_status" };
}

export function requiredPhaseSentence(flow: ScanFlow): string {
  switch (flow) {
    case "warehouse_issue":
      return "Approved";
    case "qc_test":
      return "Quarantine or Quarantine (Retest)";
    case "qc_decision":
      return "Under Test";
    default:
      return "the correct phase";
  }
}

export function flowActionTitle(flow: ScanFlow): string {
  switch (flow) {
    case "warehouse_issue":
      return "Move to production";
    case "qc_test":
      return "Start testing";
    case "qc_decision":
      return "Approve / reject";
    default:
      return "This step";
  }
}
