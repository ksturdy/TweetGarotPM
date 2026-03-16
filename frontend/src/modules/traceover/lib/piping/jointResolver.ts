import type { JointSpecFamily, JointType, PipeSize } from '../../types';

export function resolveJointType(
  pipeSize: PipeSize,
  family: JointSpecFamily | null,
): JointType | null {
  if (!family) return null;

  const sortedRules = [...family.rules].sort(
    (a, b) => a.maxSizeInches - b.maxSizeInches,
  );

  for (const rule of sortedRules) {
    if (pipeSize.nominalInches <= rule.maxSizeInches) {
      return rule.jointType;
    }
  }

  return family.defaultJointType;
}
