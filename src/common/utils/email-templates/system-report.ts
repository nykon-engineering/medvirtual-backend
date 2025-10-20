import { EmailHeader, EmailFooter } from './components';

export default function systemReport(availableCandidates, endorsedCandidates, withoutResume, failedResumeParsing, withoutHeadshot) {

  const failedResumeParsingRows = failedResumeParsing
  .map(candidate => {
    const candidateName = candidate.first_name
      ? `${candidate.first_name} ${candidate.last_name ?? ''}`
      : candidate.name ?? 'N/A';
      return `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">
            ${candidate.hubspot_id}
          </td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">
            ${candidateName}
          </td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">
            ${candidate.processing_error ?? 'N/A'}
          </td>
        </tr>
      `;
    })
    .join('');

    const withoutHeadshotRows = withoutHeadshot
    .map(candidate => {
      const candidateName = candidate.first_name
        ? `${candidate.first_name} ${candidate.last_name ?? ''}`
        : candidate.name ?? 'N/A';

      return `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">
            ${candidate.hubspot_id}
          </td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: left;">
            ${candidateName}
          </td>
        </tr>
      `;
    })
    .join('');
    
    console.log('chegou...')

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100&display=swap" rel="stylesheet"> <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      font-family: "Be Vietnam Pro",
      font-style: normal
    }
  </style>
  <title>System Report</title>
</head>

<body style="margin:0;padding:0;width:100%!important;min-width:100%;background-color:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${EmailHeader}

    <div style="padding:30px 20px;text-align:center;">
      <p style="color:#181D27;font-size:18px;line-height:1.6;">
        Hi Shayan, below is important data regarding candidates on our system.
      </p>
    </div>
    <div style="display: flex; justify-content: center; flex-wrap: wrap;">
        <div style="width: 30%; border-radius: 8%; margin: 2%; background-color: #ccc; text-align: center; padding: 10px;">
          <p style="color:#181D27;font-size:18px;line-height:1.6;margin-bottom:20px;">
            Available candidates
          </p>
          <div style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 10px 20px; border-radius: 8px;">
            ${availableCandidates}
          </div>
        </div>
        <div style="width: 30%; border-radius: 8%; margin: 2%; background-color: #ccc; text-align: center; padding: 10px;">
          <p style="color:#181D27;font-size:18px;line-height:1.6;margin-bottom:20px;">
            Endorsed candidates
          </p>
          <div style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 10px 20px; border-radius: 8px;">
            ${endorsedCandidates}
          </div>
        </div>
    </div>
    <div style="display: flex; justify-content: center; flex-wrap: wrap;">
        <div style="width: 30%; border-radius: 8%; margin: 2%; background-color: #ccc; text-align: center; padding: 10px;">
          <p style="color:#181D27;font-size:18px;line-height:1.6;margin-bottom:5px;">
            Without resume link
          </p>
          <p style="color:#555;font-size:10px;line-height:1.4;margin-bottom:15px;">
            Available candidates without resume link on hubspot profile.
          </p>
          <div style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 10px 20px; border-radius: 8px;">
            ${withoutResume}
          </div>
        </div>
        <div style="width: 30%; border-radius: 8%; margin: 2%; background-color: #ccc; text-align: center; padding: 10px;">
          <p style="color:#181D27;font-size:18px;line-height:1.6;margin-bottom:5px;">
            Failed resume parsing
          </p>
          <p style="color:#555;font-size:10px;line-height:1.4;margin-bottom:15px;">
            Candidates with resume link but resumes couldn’t be processed.
          </p>
          <div style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 10px 20px; border-radius: 8px;">
            ${failedResumeParsing.length}
          </div>
        </div>
    </div>

    <h3 style="color:#181D27;text-align:center;margin-top:40px;">Failed Resume Parsing - Candidates</h3>

    <table style="width:100%; border-collapse: collapse; margin-top:20px;">
        <thead>
        <tr style="background-color:#f4f4f4;">
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">ID</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">Candidate Name</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">Error</th>
        </tr>
        </thead>
        <tbody>
        ${failedResumeParsingRows}
        </tbody>
    </table>

    <h3 style="color:#181D27;text-align:center;margin-top:40px;">Without Headshot - Candidates</h3>
    <table style="width:100%; border-collapse: collapse; margin-top:20px; margin-bottom:20px;">
        <thead>
        <tr style="background-color:#f4f4f4;">
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">ID</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">Candidate Name</th>
        </tr>
        </thead>
        <tbody>
        ${withoutHeadshotRows}
        </tbody>
    </table>
    
    ${EmailFooter}
  </div>
</body>
</html>
`;
}
