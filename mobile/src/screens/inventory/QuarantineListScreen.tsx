import React from 'react';
import { StatusListBase } from './_StatusListBase';

export const QuarantineListScreen: React.FC = () => (
  <StatusListBase
    status="QUARANTINE"
    title="Quarantine"
    bgColor="#FFF3CD"
    textColor="#856404"
    icon="hourglass-outline"
  />
);
