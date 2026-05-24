import React from 'react';
import { FGStatusListBase } from './_FGStatusListBase';
import { Colors } from '../../utils/theme';

export const FGRejectedListScreen: React.FC = () => (
  <FGStatusListBase
    status="QA_REJECTED"
    title="Rejected"
    bgColor={Colors.danger + '22'}
    textColor={Colors.danger}
    icon="close-circle-outline"
  />
);
