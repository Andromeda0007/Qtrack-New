import React from 'react';
import { StatusListBase } from './_StatusListBase';

export const ApprovedListScreen: React.FC = () => (
  <StatusListBase
    status="APPROVED"
    title="Approved"
    bgColor="#D4EDDA"
    textColor="#155724"
    icon="checkmark-circle-outline"
  />
);
