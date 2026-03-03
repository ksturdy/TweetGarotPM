import React from 'react';
import fittingTypesImg from '../../../assets/fitting-types-reference.png';

/** Full fitting type reference image (types 1-10) from the Duct Work Fitting Order Sheet */
export const FittingTypeReference: React.FC = () => (
  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <img
      src={fittingTypesImg}
      alt="Fitting types 1-10: St. Joint, Reducer, Offset, Elbow, Tee, Wye, Dbl Branch, Tap, Transition, End Cap"
      style={{
        width: '100%',
        minWidth: 600,
        height: 'auto',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
      }}
    />
  </div>
);

export default FittingTypeReference;
