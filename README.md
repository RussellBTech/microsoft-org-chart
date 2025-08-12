# Microsoft Org Chart Management Tool

A React/TypeScript web application for visualizing and modifying organizational structures in a sandbox environment without affecting live Azure Active Directory data.

## 🚀 Features

- **Interactive Org Chart**: Drag-and-drop employee reassignment
- **Microsoft Graph Integration**: Real organizational data from Azure AD
- **Sandbox Mode**: Non-destructive editing with scenario management
- **Search & Navigation**: Find people across the organization
- **Three-State Display**: Horizontal, vertical, and collapsed views
- **Visual Indicators**: Shows moved employees in sandbox mode

## 🛠️ Deployment

### Vercel (Recommended)

1. **Fork/Clone this repository**
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect the Vite configuration

3. **Configure Environment Variables** in Vercel dashboard:
   ```
   VITE_AZURE_CLIENT_ID=your_client_id
   VITE_AZURE_TENANT_ID=your_tenant_id  
   VITE_AZURE_REDIRECT_URI=https://your-app.vercel.app
   ```

4. **Update Azure AD App Registration**:
   - Add your Vercel URL to redirect URIs
   - Enable SPA (Single Page Application) authentication

### Local Development

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

The app supports multiple configuration methods:
1. Environment variables (production)
2. Local setup wizard (development)
3. Mock data mode (demo)

## 📝 License

This project is for sandbox/development use with Microsoft organizational data.