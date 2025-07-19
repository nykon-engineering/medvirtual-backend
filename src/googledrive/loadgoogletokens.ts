import * as fs from 'fs';

export function loadGoogleTokens(): any | null {
  const tokenPath = process.env.GOOGLE_FILE_TOKENS || 'google-tokens.json';

  // Verifica se the file exists
  if (!fs.existsSync(tokenPath)) {
    console.warn('Token file not found!.');
    return null;
  }
  // Verify if the file is empty
  const stats = fs.statSync(tokenPath);
  if (stats.size === 0) {
    console.warn('Token file is empty');
    return null;
  }

  try {
    const fileContent = fs.readFileSync(tokenPath, 'utf8');
    const tokens = JSON.parse(fileContent);

    // verify if the tokens are valid
    if (!tokens.access_token && !tokens.refresh_token) {
      console.warn('Invalid tokens in the file.');
      return null;
    }

    return tokens;
  } catch (error) {
    console.error('Errr to load tokens:', error);
    return null;
  }
}
