import React from 'react';
import { StatusListBase } from './_StatusListBase';

export const RetestListScreen: React.FC = () => (
  <StatusListBase
    status="QUARANTINE_RETEST"
    title="Retest"
    bgColor="#FFF3CD"
    textColor="#856404"
    icon="refresh-circle-outline"
  />
);
