import React from 'react';
import { FGStatusListBase } from './_FGStatusListBase';
import { Colors } from '../../utils/theme';

export const FGApprovedListScreen: React.FC = () => (
  <FGStatusListBase
    status="QA_APPROVED"
    title="Approved"
    bgColor={Colors.success + '22'}
    textColor={Colors.success}
    icon="checkmark-circle-outline"
  />
);
