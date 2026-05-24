import React from 'react';
import { FGStatusListBase } from './_FGStatusListBase';
import { Colors } from '../../utils/theme';

export const FGUnderTestListScreen: React.FC = () => (
  <FGStatusListBase
    status="QA_PENDING"
    title="Under Test"
    bgColor={Colors.info + '22'}
    textColor={Colors.info}
    icon="flask-outline"
  />
);
