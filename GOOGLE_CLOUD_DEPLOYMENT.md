# Google Cloud Deployment Guide

This guide walks you through deploying your Songbook application to Google Cloud Platform using Cloud Run.

## Prerequisites

1. Google Cloud account with billing enabled
2. Google Cloud SDK (gcloud CLI) installed
3. Docker installed locally (for testing)
4. A PostgreSQL database (Supabase or Cloud SQL)

## Initial Setup

### 1. Install Google Cloud SDK

```bash
# macOS
brew install --cask google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Configure

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

## Environment Variables Setup

You need to configure these environment variables for your production deployment:

### Required Variables

```bash
# Database connection (use your Supabase or Cloud SQL connection string)
DATABASE_URL=postgresql://username:password@host:port/database

# Session secret (generate a strong random string)
SESSION_SECRET=your-secure-random-session-secret

# Node environment
NODE_ENV=production

# Port (Google Cloud Run uses 8080)
PORT=8080
```

### Optional Variables (for Google Drive integration)

If you want to enable Google Drive sync in production, you'll need to set up OAuth:

```bash
# Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

## Option 1: Deploy with Cloud Build (Recommended)

This method uses the included `cloudbuild.yaml` for automated deployment.

### 1. Create a Cloud Build trigger

```bash
# Connect your GitHub repository
gcloud builds submit --config=cloudbuild.yaml

# Or set up automatic deployment on git push
gcloud builds triggers create github \
  --repo-name=YOUR_REPO_NAME \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

### 2. Configure Secrets

Store sensitive environment variables in Google Secret Manager:

```bash
# Create secrets
echo -n "your-database-url" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "your-session-secret" | gcloud secrets create SESSION_SECRET --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member=serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member=serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 3. Update Cloud Run Service with Secrets

```bash
gcloud run services update songbook-app \
  --region=us-central1 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest
```

## Option 2: Manual Docker Deployment

### 1. Build Docker Image

```bash
# Build the image
docker build -t gcr.io/YOUR_PROJECT_ID/songbook-app:latest .

# Test locally (optional)
docker run -p 8080:8080 \
  -e DATABASE_URL="your-database-url" \
  -e SESSION_SECRET="your-session-secret" \
  -e NODE_ENV=production \
  gcr.io/YOUR_PROJECT_ID/songbook-app:latest
```

### 2. Push to Google Container Registry

```bash
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker

# Push the image
docker push gcr.io/YOUR_PROJECT_ID/songbook-app:latest
```

### 3. Deploy to Cloud Run

```bash
gcloud run deploy songbook-app \
  --image=gcr.io/YOUR_PROJECT_ID/songbook-app:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --max-instances=10 \
  --min-instances=0 \
  --timeout=300 \
  --set-env-vars=NODE_ENV=production \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest
```

## Database Setup

### Option A: Use Supabase (Current Setup)

Your app is already configured to use Supabase. Simply update the `DATABASE_URL` environment variable with your Supabase connection string.

```bash
# Format: postgresql://postgres:[password]@[host]/postgres?sslmode=require
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres?sslmode=require
```

### Option B: Use Cloud SQL

If you prefer to use Google Cloud SQL:

```bash
# Create a PostgreSQL instance
gcloud sql instances create songbook-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create a database
gcloud sql databases create songbook --instance=songbook-db

# Create a user
gcloud sql users create songbook-user \
  --instance=songbook-db \
  --password=YOUR_PASSWORD

# Get connection name
gcloud sql instances describe songbook-db --format='value(connectionName)'

# Update Cloud Run to connect to Cloud SQL
gcloud run services update songbook-app \
  --region=us-central1 \
  --add-cloudsql-instances=YOUR_CONNECTION_NAME \
  --set-env-vars=DATABASE_URL="postgresql://songbook-user:YOUR_PASSWORD@/songbook?host=/cloudsql/YOUR_CONNECTION_NAME"
```

## Post-Deployment

### 1. Run Database Migrations

After first deployment, run migrations:

```bash
# SSH into a Cloud Run instance or use Cloud Shell
npm run db:push
```

### 2. Access Your Application

```bash
# Get the service URL
gcloud run services describe songbook-app --region=us-central1 --format='value(status.url)'
```

### 3. Configure Custom Domain (Optional)

```bash
# Map a custom domain
gcloud run domain-mappings create --service=songbook-app --domain=your-domain.com --region=us-central1
```

### 4. Default Admin User

The application automatically creates a default admin user on first startup:
- Username: `admin`
- Password: `admin123`

**IMPORTANT:** Change this password immediately after first login!

## Monitoring and Logging

### View Logs

```bash
# Stream logs in real-time
gcloud run logs tail songbook-app --region=us-central1

# View logs in Cloud Console
https://console.cloud.google.com/logs
```

### Monitor Performance

```bash
# View metrics
gcloud run services describe songbook-app --region=us-central1
```

## Scaling Configuration

The default configuration allows:
- Min instances: 0 (scales to zero when idle)
- Max instances: 10
- Memory: 512Mi
- CPU: 1

To adjust scaling:

```bash
gcloud run services update songbook-app \
  --region=us-central1 \
  --min-instances=1 \
  --max-instances=20 \
  --memory=1Gi \
  --cpu=2
```

## Cost Optimization

1. **Scale to Zero**: The app scales to zero when not in use (default configuration)
2. **Right-size Resources**: Start with 512Mi memory and 1 CPU, adjust based on monitoring
3. **Use Cloud CDN**: Enable Cloud CDN for static assets if needed
4. **Database**: Use Supabase free tier or Cloud SQL smallest instance (db-f1-micro)

## Troubleshooting

### Container won't start

```bash
# Check logs
gcloud run logs tail songbook-app --region=us-central1

# Common issues:
# - DATABASE_URL not set correctly
# - SESSION_SECRET missing
# - Port not set to 8080
```

### Database connection errors

```bash
# Verify DATABASE_URL format
# Ensure database is accessible from Cloud Run
# Check Cloud SQL instance is running
# Verify firewall rules allow connections
```

### Secrets not accessible

```bash
# Verify secrets exist
gcloud secrets list

# Check IAM permissions
gcloud secrets get-iam-policy SECRET_NAME
```

## Security Best Practices

1. **Use Secret Manager** for all sensitive data (DATABASE_URL, SESSION_SECRET, API keys)
2. **Enable HTTPS** (automatic with Cloud Run)
3. **Restrict Access** using Cloud IAM if needed
4. **Regular Updates** keep dependencies up to date
5. **Monitor Logs** set up alerts for errors
6. **Backup Database** configure automated backups for Cloud SQL or use Supabase's backup features

## CI/CD Pipeline

For continuous deployment, set up a Cloud Build trigger:

1. Connect your GitHub repository
2. Create a trigger on push to main branch
3. Use the included `cloudbuild.yaml`
4. Automatic deployment on every push

## Support

For issues specific to:
- **Cloud Run**: https://cloud.google.com/run/docs
- **Cloud Build**: https://cloud.google.com/build/docs
- **Cloud SQL**: https://cloud.google.com/sql/docs
- **Supabase**: https://supabase.com/docs

## Estimated Costs

With default configuration and moderate usage:
- Cloud Run: ~$5-20/month (scales with traffic)
- Cloud SQL (db-f1-micro): ~$7/month
- Container Registry storage: ~$0.50/month
- Total: ~$12-27/month

Using Supabase free tier reduces costs to just Cloud Run charges.
