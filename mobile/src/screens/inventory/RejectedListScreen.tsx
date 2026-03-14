import React from 'react';
import { StatusListBase } from './_StatusListBase';

export const RejectedListScreen: React.FC = () => (
  <StatusListBase
    status="REJECTED"
    title="Rejected"
    bgColor="#F8D7DA"
    textColor="#721c24"
    icon="close-circle-outline"
  />
);
