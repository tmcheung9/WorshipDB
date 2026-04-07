# Quick Start: Deploy to Google Cloud

This is a condensed guide for deploying to Google Cloud Platform. For detailed instructions, see `GOOGLE_CLOUD_DEPLOYMENT.md`.

## Prerequisites

```bash
# Install Google Cloud SDK
brew install --cask google-cloud-sdk  # macOS
# or visit: https://cloud.google.com/sdk/docs/install

# Login and setup
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## 1. Enable Required APIs

```bash
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 2. Set Up Secrets

```bash
# Generate a strong session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Create secrets in Secret Manager
echo -n "YOUR_DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "$SESSION_SECRET" | gcloud secrets create SESSION_SECRET --data-file=-

# Grant access to Cloud Run
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Deploy with Cloud Build

```bash
# Option A: Manual deployment
npm run gcloud:deploy

# Option B: Automated deployment (one-time setup)
gcloud builds triggers create github \
  --repo-name=YOUR_REPO_NAME \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## 4. Configure Cloud Run Service

```bash
# Update service with secrets
gcloud run services update songbook-app \
  --region=us-central1 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest
```

## 5. Get Your URL

```bash
gcloud run services describe songbook-app \
  --region=us-central1 \
  --format='value(status.url)'
```

## Default Admin Access

After deployment, login with:
- Username: `admin`
- Password: `admin123`

**Change this password immediately!**

## Useful Commands

```bash
# View logs
npm run gcloud:logs

# Update deployment
npm run gcloud:deploy

# Scale configuration
gcloud run services update songbook-app \
  --region=us-central1 \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi

# Add custom domain
gcloud run domain-mappings create \
  --service=songbook-app \
  --domain=your-domain.com \
  --region=us-central1
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (Supabase or Cloud SQL)
- `SESSION_SECRET` - Random secure string for session encryption
- `NODE_ENV` - Set to "production"
- `PORT` - Set to 8080 (Google Cloud default)

## Troubleshooting

**Container won't start:**
```bash
gcloud run logs tail songbook-app --region=us-central1
```

**Check secrets:**
```bash
gcloud secrets list
gcloud secrets versions access latest --secret=DATABASE_URL
```

**Update secrets:**
```bash
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
```

## Cost Estimate

With default settings and moderate usage:
- Cloud Run: ~$5-20/month (pay per use)
- Container Registry: ~$0.50/month
- Total: ~$5-20/month (using Supabase free tier for database)

## Support

- Full documentation: `GOOGLE_CLOUD_DEPLOYMENT.md`
- Cloud Run docs: https://cloud.google.com/run/docs
- Cloud Build docs: https://cloud.google.com/build/docs
