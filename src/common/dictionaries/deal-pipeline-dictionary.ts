//this dictionary handle with the stage deals inside the BV OPERATIONS PIPELINE (5155250)
export const dealPipelineToDbDictionary:Record<number,string> = {
    
    16981840: 'New Launch',
    27147939: 'Retention 1-2 months',
    27147940: 'Retention 3-5 months',
    27153056: 'Retention 6-11 months',
    16981841: 'Retention 1year+',
    63353213: 'Retention 2years+',
    148283266: 'Retention 3years+',
    148234581: 'Paused Deal (for replacement)',
    1012779094: 'Replaced - Endorsed to New Launch',
    16981844: 'Lost',
    31963952: 'In Collections',
    224754753: 'Retention 4years+',
    224754754: 'Retention 5years+',
    1172012586: 'Converted Deployment',

}

export const DbToDealPipelineDictionary : Record<string, string> = Object.fromEntries(  
    Object.entries(dealPipelineToDbDictionary).map(([key, value]) => [value, key])
);