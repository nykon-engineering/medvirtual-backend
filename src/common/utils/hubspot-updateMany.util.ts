import axios from "axios";

export async function hubspotUpdateMany(candidates, pipelineStatus){
    console.log("Candidates arriving on the function: ", candidates);
    try {
        const inputs = candidates.map(c => ({
          id: c.hubspot_id,
          properties: {
            hs_pipeline_stage: pipelineStatus
          }
        }))
        const body = {
          inputs: inputs,
          idProperty: "hs_object_id"
        };
        await axios.post(
          `https://api.hubapi.com/crm/v3/objects/${process.env.HUBSPOT_CUSTOM_OBJECT}/batch/update`,
          body,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            }
          }
        );
        return true;
      } catch (error) {
        console.log('Error updating candidates in HubSpot:', error.code, error.message);
        return false;
      }
  
}