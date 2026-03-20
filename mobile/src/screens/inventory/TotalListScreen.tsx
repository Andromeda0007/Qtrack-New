import React from "react";
import { StatusListBase } from "./_StatusListBase";
import { Colors } from "../../utils/theme";

/** All product batches (any status); dashboard "Total" stat drill-down. */
export const TotalListScreen: React.FC = () => (
  <StatusListBase
    title="Total"
    bgColor="#e8eef5"
    textColor={Colors.primary}
    icon="layers-outline"
    emptyMessage="No products yet"
  />
);
