import axios from "axios";
import http from "http";
import https from "https";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });


const hubspotClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 60000, // 15 segundos, ajuste se necessário
});


export async function hubspotUpdateMany(candidates, pipelineStatus) {
  //return true; // Temporarily returning true to avoid breaking changes

  try {
    const inputs = candidates.map(c => ({
      id: c.hubspot_id,
      properties: {
        hs_pipeline_stage: pipelineStatus
      }
    }));

    const body = {
      inputs,
      idProperty: "hs_object_id",
    };

    await hubspotClient.post(
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
  } catch (error: any) {
    console.log('Error updating candidates in HubSpot:', error.code, error.message);
    return false;
  }
}

export async function hubspotUpdateMany_old(candidates, pipelineStatus){
  return true;  
  
    try {
        const inputs = await candidates.map(c => ({
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