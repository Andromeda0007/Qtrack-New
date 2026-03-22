import React from "react";
import { StatusListBase } from "./_StatusListBase";
import { Colors } from "../../utils/theme";

/** Batches issued to production (partially or fully dispensed). */
export const ProductionListScreen: React.FC = () => (
  <StatusListBase
    status="ISSUED_TO_PRODUCTION"
    title="Production"
    bgColor="#e8eef5"
    textColor={Colors.primary}
    icon="layers-outline"
    emptyMessage="No batches issued to production"
  />
);
