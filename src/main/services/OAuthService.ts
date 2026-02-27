// Microsoft 365 OAuth via MSAL Node
// NOTE: Requires Azure AD app registration. See README for setup instructions.
//
// Required scopes: https://outlook.office.com/IMAP.AccessAsUser.All offline_access
// Register your app at: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
// Set redirect URI to: http://localhost:12345

export const M365_CLIENT_ID = 'YOUR_AZURE_APP_CLIENT_ID'
export const M365_AUTHORITY = 'https://login.microsoftonline.com/common'

class OAuthService {
  async startM365Flow(): Promise<{ accessToken: string; refreshToken: string }> {
    throw new Error(
      'Microsoft 365 OAuth not yet configured. ' +
        'Register an Azure AD app and set M365_CLIENT_ID in OAuthService.ts. ' +
        'Redirect URI: http://localhost:12345'
    )
  }

  async refreshM365Token(_refreshToken: string): Promise<string> {
    throw new Error('M365 token refresh not implemented')
  }
}

export const oauthService = new OAuthService()
