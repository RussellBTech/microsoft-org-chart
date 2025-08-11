# Microsoft Org Chart Tool - Architecture Plan (Self-Service Model)

## Overview
A self-service, client-side only web application where each organization uses their own Azure AD credentials to visualize and manage org charts. No backend infrastructure required - pure static hosting with direct Microsoft Graph API integration.

## Architecture Components

### 1. Frontend (React SPA) - ONLY Component
**Location:** Cloudflare Pages (static hosting)  
**Authentication:** MSAL.js with user-provided Azure AD credentials  
**Data Storage:** Browser localStorage only  
**Graph API:** Direct calls from frontend using user's token

### 2. No Backend Required
- All API calls made directly from browser
- User's Azure AD token used for Graph API
- No proxy servers or databases needed
- Scenarios stored in localStorage

### 3. Configuration Methods

#### Option A: Environment Variables (.env.local)
```bash
# Users create their own .env.local file
VITE_AZURE_CLIENT_ID=their-client-id
VITE_AZURE_TENANT_ID=their-tenant-id
VITE_AZURE_REDIRECT_URI=https://org-chart.pages.dev
```

#### Option B: Setup Wizard UI
- First-run setup screen
- User enters Azure AD app details
- Stored in localStorage for future sessions
- Includes validation and testing

## Authentication Flow (Simplified)

1. **User visits app** → Check for Azure AD config
2. **No config** → Show setup wizard
3. **Has config** → Initiate MSAL login
4. **Azure AD login** → User authenticates with their org
5. **Get token** → Receive access token for Graph API
6. **Direct API calls** → Use token for all Graph requests
7. **Token refresh** → MSAL handles automatically

## Data Flow (Client-Side Only)

### Initial Load
1. Authenticate user via their Azure AD
2. Fetch org data directly from Graph API
3. Transform response to Employee format
4. Render org chart
5. Cache in localStorage (optional)

### Scenario Management
1. User edits in sandbox mode (React state)
2. Save scenario → Store in localStorage
3. Export scenario → Generate JSON/PDF client-side
4. Share scenario → Copy JSON to clipboard
5. Import scenario → Paste JSON, validate, apply

## Implementation Phases

### Phase 1: Setup Wizard & Config
- [ ] Create setup wizard component
- [ ] Add Azure AD config validation
- [ ] Store config in localStorage
- [ ] Create setup documentation

### Phase 2: MSAL Integration
- [ ] Install MSAL.js
- [ ] Implement auth provider
- [ ] Add login/logout flow
- [ ] Handle token refresh

### Phase 3: Graph API Integration
- [ ] Replace mock data with Graph API calls
- [ ] Transform Graph response to Employee format
- [ ] Add error handling and retries
- [ ] Implement data caching in localStorage

### Phase 4: Enhanced Features
- [ ] Client-side PDF export (jsPDF or similar)
- [ ] Import/export scenarios as JSON
- [ ] Add performance optimizations
- [ ] Polish UI/UX

### Phase 5: Deployment
- [ ] Deploy to Cloudflare Pages
- [ ] Create setup instructions
- [ ] Test with multiple tenants
- [ ] Document Azure AD app registration steps

## Deployment Guide for Organizations

### Step 1: Register Azure AD Application
1. Go to Azure Portal → Azure Active Directory
2. App registrations → New registration
3. Set redirect URI: `https://org-chart.pages.dev`
4. API permissions → Add → Microsoft Graph → User.Read.All
5. Grant admin consent

### Step 2: Configure the Tool
**Option A: Fork and Deploy**
```bash
# Fork the repository
# Clone your fork
git clone your-fork-url
cd microsoft-org-chart/frontend

# Create .env.local
echo "VITE_AZURE_CLIENT_ID=your-client-id" >> .env.local
echo "VITE_AZURE_TENANT_ID=your-tenant-id" >> .env.local

# Build and deploy
npm install
npm run build
# Deploy dist/ to your hosting
```

**Option B: Use Hosted Version**
1. Visit https://org-chart.pages.dev
2. Click "Setup" on first visit
3. Enter your Azure AD credentials
4. Test connection
5. Start using immediately

## Security Considerations (Simplified)

1. **Authentication:**
   - Each org uses their own Azure AD
   - No shared authentication infrastructure
   - Tokens never leave the browser

2. **Data Isolation:**
   - All data stays in user's browser
   - No cross-tenant data access possible
   - Scenarios stored locally only

3. **Zero Trust Model:**
   - No backend to compromise
   - Direct Graph API calls only
   - User controls all credentials

## Benefits of Self-Service Model

- **For Organizations:**
  - Complete data control
  - No vendor lock-in
  - Use existing Azure AD setup
  - No data sharing concerns

- **For Deployment:**
  - Zero infrastructure cost
  - No backend maintenance
  - Instant updates via CDN
  - Scales infinitely

- **For Security:**
  - No central database to breach
  - Each org isolated completely
  - Credentials never shared
  - Full audit trail in Azure AD

## Open Source Considerations

- MIT License for maximum flexibility
- Clear setup documentation
- Docker option for self-hosting
- Community-driven improvements

## Questions Resolved

1. **Pagination?** → Yes, Graph API handles automatically
2. **Real-time updates?** → No, refresh button sufficient
3. **Shareable scenarios?** → Via JSON export/import
4. **PDF library?** → jsPDF for client-side generation
5. **Offline mode?** → localStorage cache provides basic offline