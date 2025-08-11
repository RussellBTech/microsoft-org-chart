# Azure AD Setup Guide for Org Chart Manager

This guide will help you configure Azure Active Directory to use with the Org Chart Manager application.

## Prerequisites

- Admin access to your Azure Active Directory tenant
- Permission to register applications in Azure AD

## Step 1: Register an Application in Azure AD

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name**: `Org Chart Manager` (or your preferred name)
   - **Supported account types**: Select based on your needs:
     - Single tenant (your organization only) - Recommended
     - Multi-tenant (any Azure AD directory)
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URI: Your app URL (e.g., `http://localhost:5173` for development or `https://your-domain.com` for production)

5. Click **Register**

## Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `User.Read` - Sign in and read user profile
   - `User.ReadBasic.All` - Read all users' basic profiles
   - `User.Read.All` - Read all users' full profiles (requires admin consent)
6. Click **Add permissions**
7. Click **Grant admin consent** (requires admin privileges)

## Step 3: Note Your Application Details

From the **Overview** page of your app registration, copy:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## Step 4: Configure the Org Chart Manager

### Option A: Using Environment Variables

Create a `.env.local` file in the frontend directory:

```bash
VITE_AZURE_CLIENT_ID=your-client-id-here
VITE_AZURE_TENANT_ID=your-tenant-id-here
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

### Option B: Using the Setup Wizard

1. Start the application without configuration
2. The setup wizard will appear automatically
3. Enter your:
   - Application (Client) ID
   - Directory (Tenant) ID
   - Redirect URI (defaults to current URL)
4. Click "Save Configuration"

## Step 5: Test Your Configuration

1. Start the application:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. If using the setup wizard, follow the on-screen instructions
3. Sign in with your Azure AD account
4. Verify that the org chart loads with your organization's data

## Troubleshooting

### Common Issues

#### "AADSTS50011: The reply URL specified in the request does not match..."
- Ensure the redirect URI in your app configuration exactly matches the one in Azure AD
- Check for trailing slashes and protocol (http vs https)

#### "AADSTS65001: The user or administrator has not consented..."
- Admin consent is required for `User.Read.All` permission
- Have an admin grant consent in Azure Portal

#### "AADSTS700016: Application with identifier 'xxx' was not found..."
- Verify the Client ID is correct
- Ensure you're using the right tenant

#### No data appears after login
- Check that API permissions are granted
- Verify admin consent was provided
- Ensure users exist in the Azure AD tenant

### Security Best Practices

1. **Production Deployment**:
   - Always use HTTPS in production
   - Register separate apps for dev/staging/production
   - Limit redirect URIs to specific domains

2. **Permissions**:
   - Only request permissions you need
   - Use least privilege principle
   - Review permissions regularly

3. **Token Handling**:
   - Tokens are stored in browser memory only
   - No tokens are sent to external servers
   - Tokens expire automatically and refresh as needed

## Using Demo Mode

If you want to test the application without Azure AD:

1. Click "Use Demo Data" on the setup screen
2. Explore the application with sample organizational data
3. All features work except real Graph API integration

## Support

For issues specific to:
- **Azure AD configuration**: Consult [Microsoft Graph documentation](https://docs.microsoft.com/en-us/graph/)
- **Application bugs**: Open an issue in the project repository
- **Setup wizard**: The wizard includes built-in help and validation

## Next Steps

After successful setup:
1. Explore the org chart visualization
2. Try sandbox mode for testing reorganizations
3. Save and export scenarios
4. Configure role-based access if needed