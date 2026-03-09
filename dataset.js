//dataset.js
export const DATASETS = {
  school: {
    key: 'school',
    id: 'School',
    label: 'School Temporal Graph',
    data: () => import('./dataset/primarySchool/graph-data-times.js'),
    periods: () => import('./dataset/primarySchool/periodDefs.js'),
  },
  hospital: {
    key: 'hospital',
    id: 'Hospital',
    label: 'Hospital Temporal Graph',
    data: () => import('./dataset/hospital/graph-data-times.js'),
    periods: () => import('./dataset/hospital/hospitalDefs.js'),
  },
};

export function getDatasetList() {
  let datasetList = [];

  for (const datasetKey in DATASETS) {
    datasetList.push(DATASETS[datasetKey].id);
  }

  return datasetList;
}