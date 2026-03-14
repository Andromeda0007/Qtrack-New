import React from 'react';
import { StatusListBase } from './_StatusListBase';

export const UnderTestListScreen: React.FC = () => (
  <StatusListBase
    status="UNDER_TEST"
    title="Under Test"
    bgColor="#CCE5FF"
    textColor="#004085"
    icon="flask-outline"
  />
);
