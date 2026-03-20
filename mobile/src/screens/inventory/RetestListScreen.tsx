import React from 'react';
import { StatusListBase } from './_StatusListBase';
import { Colors } from '../../utils/theme';

export const RetestListScreen: React.FC = () => (
  <StatusListBase
    status="QUARANTINE_RETEST"
    title="Retest"
    bgColor="#ffe8d6"
    textColor={Colors.statusQuarantine}
    icon="refresh-circle-outline"
  />
);
