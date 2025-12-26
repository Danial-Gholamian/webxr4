import { SchoolTemporalGraphAdapter } from './schoolTemporalGraphAdapter.js';

export const DATASETS = {
  school: {
    id: 'school',
    label: 'School Temporal Graph',
    data: () => import('./dataset/primarySchool/graph-data-periods.js'),
    periods: () => import('./dataset/primarySchool/periodDefs.js'),
  },
  hospital: {
    id: 'hospital',
    label: 'Hospital Temporal Graph',
    data: () => import('./dataset/hospital/hospital-data-period.js'),
    periods: () => import('./dataset/hospital/hospitalDefs.js'),
  },
};