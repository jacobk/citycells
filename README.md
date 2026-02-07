# CityCells

**CityCells** is a Next.js application that visualizes Strava activities over city sub-areas (delområden). It provides a unique perspective on your activity distribution across the city.

## Tech Stack

*   **Framework**: Next.js 16 (App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS v4, PostCSS
*   **Maps**: Leaflet, React-Leaflet, Turf.js
*   **Auth**: Strava OAuth

## Getting Started

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Run the development server:**

    ```bash
    npm run dev
    ```

3.  **Open the app:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

CityCells is deployed to **Vercel** as a unified Next.js application. The deployment includes both the frontend React application and server-side API routes for Strava OAuth and data fetching.

### Deployment URL

**Production**: [https://citycells.vercel.app](https://citycells.vercel.app) *(Update this after first deployment)*

### Deploying to Vercel

#### Prerequisites

- A Vercel account ([sign up](https://vercel.com))
- GitHub repository access
- Strava OAuth app credentials

#### Initial Setup

1. **Connect Repository to Vercel**
   - Sign in to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import the `citycells` GitHub repository
   - Vercel will auto-detect Next.js settings (no changes needed)

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add the following variables for **Production**, **Preview**, and **Development**:
     - `STRAVA_CLIENT_ID`: Your Strava OAuth client ID
     - `STRAVA_CLIENT_SECRET`: Your Strava OAuth client secret
   - **Note**: `STRAVA_REDIRECT_URI` will be set after first deployment (see step 3)

3. **Initial Deployment**
   - Vercel will automatically trigger the first deployment
   - The build may succeed, but OAuth will fail until `STRAVA_REDIRECT_URI` is configured (this is expected)
   - After deployment, note your Vercel URL (e.g., `citycells-xyz.vercel.app`)

4. **Configure OAuth Redirect URI**
   - In Vercel, add environment variable:
     - `STRAVA_REDIRECT_URI`: `https://{your-vercel-url}.vercel.app/api/auth/callback`
   - Update Strava OAuth App Settings:
     - Go to [Strava API Settings](https://www.strava.com/settings/api)
     - Find your application
     - Update "Authorization Callback Domain" to: `{your-vercel-url}.vercel.app`
     - Or add full redirect URI: `https://{your-vercel-url}.vercel.app/api/auth/callback`
     - Save changes
   - Redeploy the application (trigger new deployment or push a commit)

5. **Verify Deployment**
   - Visit your deployed URL
   - Verify the application loads correctly
   - Test "Connect with Strava" button
   - Verify OAuth flow completes successfully
   - Confirm activities load after authentication

#### Ongoing Deployments

- **Automatic**: Pushing to `main` branch triggers production deployment
- **Preview**: Pull requests automatically get preview deployments with unique URLs
- **Manual**: Redeploy from Vercel dashboard if needed

### Environment Variables

The following environment variables must be configured in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `STRAVA_CLIENT_ID` | Strava OAuth client ID | `217` |
| `STRAVA_CLIENT_SECRET` | Strava OAuth client secret (server-side only) | `967dace825...` |
| `STRAVA_REDIRECT_URI` | OAuth callback URL | `https://citycells.vercel.app/api/auth/callback` |

**Important**: Never commit `.env.local` or environment variable values to the repository.

### Architecture

See [ADR 016: Vercel Deployment Platform](docs/ADR/016-vercel-deployment.md) for detailed architecture decisions and [Deployment Feature Documentation](docs/features/deployment.md) for implementation details.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests. We strictly enforce **Conventional Commits**.

## License

[MIT](LICENSE)
