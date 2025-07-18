import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENTE_ID,
    process.env.GOOGLE_CLIENTE_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const code = 'CODE';

oauth2Client.getToken(code).then(({ tokens }) => {
  console.log('Tokens:');
  console.log(tokens);
}).catch(console.error);
