import type { JointType } from '../../types';

export interface CompanionItem {
  fittingLabel: string;
  abbreviation: string;
  quantity: number;
  description: string;
}

const COMPANION_TRIGGER_PREFIXES = [
  'valve_',
  'strainer_',
  'trap_',
  'expansion_joint',
  'flex_connector',
];

function isCompanionTrigger(catalogId: string): boolean {
  return COMPANION_TRIGGER_PREFIXES.some((p) => catalogId.startsWith(p));
}

export function getCompanionItems(
  catalogId: string,
  jointType: JointType | undefined | null,
): CompanionItem[] {
  if (!jointType || !isCompanionTrigger(catalogId)) return [];

  switch (jointType) {
    case 'welded':
      return [{
        fittingLabel: 'Flange',
        abbreviation: 'FL',
        quantity: 2,
        description: 'Weld-neck Flange',
      }];

    case 'grooved':
    case 'victaulic':
      return [{
        fittingLabel: 'Grooved Coupling',
        abbreviation: 'GC',
        quantity: 2,
        description: 'Grooved Coupling',
      }];

    case 'soldered_9505':
    case 'soldered_5050':
    case 'brazed':
      return [{
        fittingLabel: 'Union',
        abbreviation: 'UN',
        quantity: 2,
        description: 'Union',
      }];

    case 'threaded':
      return [{
        fittingLabel: 'Union',
        abbreviation: 'UN',
        quantity: 2,
        description: 'Union',
      }];

    case 'flanged':
      return [];

    default:
      return [];
  }
}
