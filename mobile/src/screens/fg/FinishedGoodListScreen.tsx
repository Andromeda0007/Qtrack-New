import React from 'react';
import { FGStatusListBase } from './_FGStatusListBase';

export const FinishedGoodListScreen: React.FC = () => (
  <FGStatusListBase
    status="CREATED"
    title="Finished Good"
    bgColor="#FFF3CD"
    textColor="#856404"
    icon="cube-outline"
  />
);
