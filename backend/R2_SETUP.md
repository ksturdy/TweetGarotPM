# Cloudflare R2 Setup Guide

This guide explains how to configure Cloudflare R2 object storage for file uploads in the Tweet Garot PM application.

## What is Cloudflare R2?

Cloudflare R2 is an S3-compatible object storage service that stores files in the cloud. It's used to store:
- Drawing files (PDF, DWG, DXF, RVT, images)
- Specification documents (PDF, DOC, DOCX, TXT)
- Contract review files (PDF, DOCX, TXT)

## Prerequisites

1. A Cloudflare account
2. A Cloudflare R2 bucket created
3. R2 API credentials (Access Key ID and Secret Access Key)

## Step 1: Create R2 Bucket

1. Log in to your Cloudflare dashboard
2. Navigate to **R2** in the left sidebar
3. Click **Create bucket**
4. Enter a bucket name (e.g., `tweetgarot-pm-files`)
5. Choose a location (or leave as automatic)
6. Click **Create bucket**

## Step 2: Generate R2 API Credentials

1. In the R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure the token:
   - **Token name**: `tweetgarot-pm-backend`
   - **Permissions**:
     - Object Read
     - Object Write
     - Object Delete
   - **Bucket restrictions**: Select your bucket (or "All buckets")
   - **TTL**: No expiry (or set your preference)
4. Click **Create API token**
5. **IMPORTANT**: Copy the following credentials immediately (they won't be shown again):
   - Access Key ID
   - Secret Access Key
   - Account ID (found in R2 dashboard)

## Step 3: Configure Environment Variables

Add the following environment variables to your `backend/.env` file:

```env
# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id_here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key_here
CLOUDFLARE_R2_BUCKET_NAME=tweetgarot-pm-files
CLOUDFLARE_R2_REGION=auto
CLOUDFLARE_R2_PUBLIC_URL=https://your-bucket.your-account-id.r2.cloudflarestorage.com
```

### Finding Your Values:

- **CLOUDFLARE_R2_ACCOUNT_ID**: Found in R2 dashboard or when creating API token
- **CLOUDFLARE_R2_ACCESS_KEY_ID**: From Step 2 (API token creation)
- **CLOUDFLARE_R2_SECRET_ACCESS_KEY**: From Step 2 (API token creation)
- **CLOUDFLARE_R2_BUCKET_NAME**: The name you chose in Step 1
- **CLOUDFLARE_R2_REGION**: Keep as `auto` (or specify a region if needed)
- **CLOUDFLARE_R2_PUBLIC_URL**: Optional - only if you've configured a public domain for your bucket

## Step 4: Optional - Configure Public Access (Custom Domain)

If you want files to be publicly accessible via a custom domain:

1. In your R2 bucket settings, click **Settings**
2. Under **Public access**, click **Connect domain**
3. Choose either:
   - **Cloudflare domain**: Use a domain managed by Cloudflare
   - **Custom domain**: Use any domain (requires DNS configuration)
4. Follow the prompts to connect your domain
5. Update `CLOUDFLARE_R2_PUBLIC_URL` in `.env` with your custom domain URL

**Note**: If you don't configure public access, files will be served via presigned URLs (temporary, secure links generated on-demand).

## Step 5: Restart Your Backend

```bash
cd backend
npm install  # Install new dependencies (@aws-sdk/client-s3, etc.)
npm run dev  # Restart development server
```

## Step 6: Verify Configuration

1. Check the backend console logs when it starts:
   - You should see: `"Cloudflare R2 client initialized successfully"`
   - You should see: `"Using Cloudflare R2 - files served via presigned URLs"`

2. Test file upload:
   - Upload a drawing, specification, or contract review
   - Check your R2 bucket dashboard - the file should appear in `uploads/drawings/`, `uploads/specifications/`, or `uploads/contracts/`
   - Download the file to verify it works

## How It Works

### Upload Flow:
1. User uploads file via frontend
2. File is sent to backend API endpoint
3. Multer middleware processes upload
4. File is uploaded directly to R2 (not stored locally)
5. File metadata (key, size, type) is saved to PostgreSQL database

### Download Flow:
1. User clicks download/view file
2. Backend generates a presigned URL (valid for 1 hour)
3. User is redirected to presigned URL
4. File is served directly from R2

### File Organization in R2:
```
bucket-name/
├── uploads/
│   ├── drawings/
│   │   └── 1234567890-123456789-blueprint.pdf
│   ├── specifications/
│   │   └── 1234567890-123456789-specs.docx
│   └── contracts/
│       └── 1234567890-123456789-contract.pdf
```

## Fallback to Local Storage

If R2 credentials are **not configured**, the system automatically falls back to local file storage:

- Files are stored in `backend/uploads/` directory
- Files are served via Express static middleware
- No additional configuration needed

This allows you to:
- Develop locally without R2
- Gradually migrate to R2 in production

## Troubleshooting

### Issue: "R2 credentials not configured" warning

**Solution**: Check that all R2 environment variables are set in `.env` file

### Issue: Upload fails with "Access Denied"

**Solution**:
1. Verify API token has correct permissions (Read, Write, Delete)
2. Check that bucket name matches the token's bucket restrictions
3. Ensure credentials are correct (no extra spaces or quotes)

### Issue: Files upload but download fails

**Solution**:
1. Check that presigned URL expiration is not too short (default: 1 hour)
2. Verify bucket permissions allow GetObject operation
3. Check browser console for CORS errors

### Issue: CORS errors when downloading files

**Solution**:
1. In R2 bucket settings, add CORS policy:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Issue: Want to migrate existing local files to R2

**Solution**:
1. Create a migration script using the AWS SDK
2. Loop through all database records with `file_path`
3. Upload each local file to R2
4. Update database `file_path` to R2 key
5. Optionally delete local files after verification

## Cost Considerations

Cloudflare R2 pricing (as of 2024):
- **Storage**: $0.015/GB per month
- **Class A operations** (uploads, writes): $4.50 per million requests
- **Class B operations** (downloads, reads): $0.36 per million requests
- **Egress**: FREE (no bandwidth charges)

For a typical small-to-medium project management application:
- Storage: ~100GB = $1.50/month
- Operations: ~100k requests/month = $0.50/month
- **Total**: ~$2/month

## Security Best Practices

1. **Never commit credentials to Git**: Always use `.env` file (already in `.gitignore`)
2. **Use presigned URLs**: Don't make bucket publicly accessible unless necessary
3. **Set expiration on API tokens**: Rotate tokens periodically
4. **Limit bucket access**: Use bucket-specific tokens, not account-wide
5. **Monitor usage**: Check R2 dashboard for unexpected spikes in storage or requests

## Technical Details

### Custom R2 Storage Engine

This implementation uses a **custom multer storage engine** instead of `multer-s3` to avoid version compatibility issues with AWS SDK v3. The custom engine:

- Handles file stream processing
- Uploads directly to R2 using `@aws-sdk/client-s3`
- Returns file metadata in multer-compatible format
- Supports the same API as standard multer storage

### Dependencies

- `@aws-sdk/client-s3` - S3-compatible client for R2
- `@aws-sdk/s3-request-presigner` - Generate presigned URLs
- `multer` - File upload middleware

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Multer Documentation](https://github.com/expressjs/multer)

## Need Help?

If you encounter issues not covered here:
1. Check backend console logs for detailed error messages
2. Review R2 dashboard for API errors or quota issues
3. Consult the [CLAUDE.md](../CLAUDE.md) file for project architecture details
