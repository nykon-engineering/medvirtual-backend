import { dealPipelineToDbDictionary } from '../dictionaries/deal-pipeline-dictionary';

export const activePipelines = Object.entries(
  dealPipelineToDbDictionary,
).filter(
  ([key]) =>
    key !== '148234581' &&
    key !== '1012779094' &&
    key !== '16981844' &&
    key !== '31963952' &&
    key !== '159176450' &&
    key !== '1012777775' &&
    key !== '159176451' &&
    key !== '159176452',
);
