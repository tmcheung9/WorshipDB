# Cloud Run Deployment Steps

Your application is now configured for deployment. Follow these steps to deploy to Google Cloud Run.

## Prerequisites

Ensure you have:
- Google Cloud CLI installed (`gcloud`)
- Authenticated with your Google Cloud account
- A Google Cloud project created

## Step 1: Set Up Google Cloud Secrets

You need to create two secrets in Google Cloud Secret Manager:

```bash
# Create DATABASE_URL secret
echo -n "postgresql://neondb_owner:npg_Sic6pLmkl4sh@ep-dry-breeze-afjq1g6s.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Create SESSION_SECRET (generate a random 32-character string)
openssl rand -base64 32 | gcloud secrets create SESSION_SECRET --data-file=-
```

## Step 2: Grant Cloud Run Access to Secrets

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Grant access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 3: Deploy to Cloud Run

```bash
# Deploy using Cloud Build
npm run gcloud:deploy
```

## Step 4: View Logs

After deployment, you can view the logs to ensure everything is working:

```bash
npm run gcloud:logs
```

## What Was Fixed

1. **Dockerfile Updates**:
   - Added copy of `shared` directory (database schema)
   - Added copy of `client/dist` directory (built frontend)
   - Ensures all required files are in the production container

2. **Cloud Build Configuration**:
   - Added DATABASE_URL and SESSION_SECRET as secrets
   - Configured PORT=8080 explicitly
   - Secrets are injected at runtime from Google Secret Manager

3. **Environment Variables**:
   - DATABASE_URL configured for your Neon database
   - SESSION_SECRET placeholder added (will be replaced by secret in production)

## Troubleshooting

If deployment fails:

1. Check logs: `npm run gcloud:logs`
2. Verify secrets exist: `gcloud secrets list`
3. Verify IAM permissions: `gcloud secrets get-iam-policy DATABASE_URL`
4. Check Cloud Build history: `gcloud builds list --limit=5`

## Default Admin Credentials

Once deployed, log in with:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

## Next Steps

After successful deployment:
1. Access your app at the Cloud Run URL
2. Change the admin password
3. Configure Google Drive sync if needed
4. Upload your first PDF files

## Cost Optimization

The current configuration uses:
- Minimum instances: 0 (scales to zero when not in use)
- Maximum instances: 10
- Memory: 512Mi
- CPU: 1

This will minimize costs while providing good performance. Adjust in `cloudbuild.yaml` if needed.
