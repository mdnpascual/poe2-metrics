# Feature 12: AWS Migration

## Status: In Progress

## Completed
- [x] S3 bucket created (`poe2-build-explorer`, us-east-1, private + OAC)
- [x] EC2 instance launched (t3.micro, `i-xxxxxxxxxxxxxxxxx`, Amazon Linux 2023)
- [x] Node.js 20 installed, systemd service configured (`poe2-explorer`)
- [x] Backend deployed and running (Apollo Server + Express + compression)
- [x] DuckDB uploaded (151MB, 11,388 chars, 241,945 items)
- [x] CloudFront distribution created (`xxxxxxxxxxxxxx.cloudfront.net`, ID: `EXXXXXXXXXXXXX`)
- [x] CloudFront behaviors: /graphql → EC2, /api/trade2/* → GGG, default → S3
- [x] Frontend deployed to S3 and serving via CloudFront
- [x] Compression verified (18.5MB → 1.27MB brotli, 93% reduction)
- [x] Port 4000 restricted to CloudFront IPs (prefix list)
- [x] Deploy scripts created (deploy:frontend, deploy:backend, deploy:db, aws:start, aws:stop)
- [x] ACM certificate requested for poe2metrics.com

## Remaining
- [ ] Complete domain registration for poe2metrics.com (AWS support ticket — payment method was expired, now fixed)
- [ ] Validate ACM certificate via DNS (add CNAME to Route 53 hosted zone)
- [ ] Attach certificate + custom domain to CloudFront distribution
- [ ] Create Route 53 alias record: poe2metrics.com → CloudFront
- [ ] Automate CloudFront origin update in aws-start.ps1 (after IP changes on stop/start)

## Priority: Next (after Feature 11)

## Description
Host the PoE2 Build Explorer on AWS instead of running locally or tunneling via LocalToNet. The frontend (static React build) is served from S3 + CloudFront. The backend (Node.js + Apollo Server) runs on an EC2 instance (or ECS/App Runner). The DuckDB file (~158MB) is stored in S3 and downloaded to the backend instance on deploy/startup.

Scraping and ingestion remain local to avoid AWS compute costs. After local ingestion, a deploy script uploads the new DuckDB to S3 and triggers the backend to reload it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Machine                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Scraper      │ →  │ Ingest       │ →  │ explorer_v2.duckdb│  │
│  │ (poe.ninja)  │    │ (ingestv2.ts)│    │ (local file)      │  │
│  └──────────────┘    └──────────────┘    └───────────────────┘  │
│                                                  │               │
│                                    npm run deploy:db              │
│                                                  ▼               │
└──────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  AWS                                                             │
│                                                                  │
│  ┌──────────────────┐         ┌─────────────────────────────┐  │
│  │ S3 Bucket        │         │ EC2 / App Runner / ECS      │  │
│  │ - dist/ (frontend)│◄──────│ - Node.js backend           │  │
│  │ - explorer_v2.duckdb│────►│ - Downloads DuckDB on start  │  │
│  └────────┬─────────┘         └─────────────────────────────┘  │
│           │                              ▲                       │
│           ▼                              │                       │
│  ┌──────────────────┐                   │                       │
│  │ CloudFront       │                   │                       │
│  │ - Serves frontend│   /graphql ───────┘                       │
│  │ - Proxies /graphql│                                          │
│  └──────────────────┘                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## AWS Services

| Service | Purpose | Cost Consideration |
|---------|---------|-------------------|
| S3 | Store frontend bundle + DuckDB file | Minimal (storage + transfer) |
| CloudFront | CDN for frontend, gzip/brotli, HTTPS, route /graphql to backend | Free tier covers most usage |
| EC2 (t3.small/medium) | Run Node.js backend with DuckDB in-process | ~$15-30/month |
| (Alternative) App Runner | Managed container for backend, auto-scaling | ~$5-25/month depending on traffic |

## Design Decisions

### Why S3 for DuckDB storage?
- DuckDB file is ~158MB — too large for container image but fine for S3
- Decouples data updates from code deploys
- Can version/rollback by keeping old files

### Why local scrape + ingest?
- Scraping poe.ninja is I/O-bound and free locally
- Ingestion into DuckDB is CPU-bound but fast on local machine
- Avoids paying for EC2 time during batch processing
- Upload only the final artifact (~158MB, ~30s on decent connection)

### Backend DuckDB loading
- On startup, backend downloads `s3://bucket/explorer_v2.duckdb` to local disk
- Opens DuckDB from local file (same as current behavior)
- A `deploy:db` script uploads new file and optionally restarts the backend service

### Frontend deployment
- `vite build` produces `dist/` folder
- Upload to S3, invalidate CloudFront cache
- No server-side rendering needed

## Package.json Scripts

```json
{
  "deploy:frontend": "vite build && aws s3 sync dist/ s3://$BUCKET_NAME/frontend/ --delete && aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths '/*'",
  "deploy:backend": "...",
  "deploy:db": "aws s3 cp explorer_v2.duckdb s3://$BUCKET_NAME/data/explorer_v2.duckdb",
  "deploy:all": "npm run deploy:frontend && npm run deploy:db && npm run deploy:backend"
}
```

The actual scripts will use a `deploy.config.json` or environment variables for bucket name, distribution ID, and instance/service identifiers.

## Deploy Config

```json
// deploy.config.json (gitignored)
{
  "awsRegion": "us-east-1",
  "s3Bucket": "poe2-build-explorer",
  "cloudfrontDistributionId": "EXXXXXXXXX",
  "backendService": "poe2-explorer-backend",
  "dbS3Key": "data/explorer_v2.duckdb"
}
```

## Implementation Tasks

### Phase 1: Infrastructure Setup
- [ ] Create S3 bucket for frontend assets and DuckDB storage
- [ ] Configure CloudFront distribution pointing to S3 (frontend) + backend origin (/graphql)
- [ ] Set up EC2 instance or App Runner service for backend
- [ ] Configure backend to download DuckDB from S3 on startup
- [ ] Set up IAM roles/policies for S3 access

### Phase 2: Deploy Scripts
- [ ] Create `deploy.config.json` template (with .gitignore entry)
- [ ] Add `deploy:frontend` script — build + S3 sync + CloudFront invalidation
- [ ] Add `deploy:db` script — upload DuckDB to S3
- [ ] Add `deploy:backend` script — restart backend service (to pick up new DB)
- [ ] Add `deploy:all` script — runs all three in sequence

### Phase 3: Backend Modifications
- [ ] Modify `server/db.ts` to check for S3-sourced DuckDB (download if `DB_SOURCE=s3`)
- [ ] Add health check endpoint (`GET /health`)
- [ ] Ensure compression middleware works in production
- [ ] Remove Vite proxy config for production (CloudFront handles routing)

### Phase 4: Production Vite Config
- [ ] Add production build that points `/graphql` to the real backend URL (or relative path via CloudFront)
- [ ] Remove `/api/trade2` proxy — in production, client calls GGG directly or CloudFront proxies it

## Environment Variables (Backend)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend listen port | `4000` |
| `DB_SOURCE` | `local` or `s3` | `local` |
| `S3_BUCKET` | S3 bucket name | — |
| `S3_DB_KEY` | S3 key for DuckDB file | `data/explorer_v2.duckdb` |
| `AWS_REGION` | AWS region | `us-east-1` |

## Acceptance Criteria
- [ ] Frontend is accessible via CloudFront HTTPS URL
- [ ] Backend responds to GraphQL queries on AWS
- [ ] DuckDB loads from S3 on backend startup
- [ ] `npm run deploy:frontend` builds and uploads frontend, invalidates cache
- [ ] `npm run deploy:db` uploads local DuckDB to S3
- [ ] `npm run deploy:backend` restarts the backend to pick up new DB
- [ ] `npm run deploy:all` does full deployment in one command
- [ ] Local development workflow unchanged (still uses local DuckDB file)
- [ ] deploy.config.json is gitignored

## Files to Create/Modify
- `.kiro/features/feature_12_aws_migration/feature.md` — this spec
- `deploy.config.json` — AWS resource identifiers (gitignored)
- `deploy.config.example.json` — template for others
- `server/db.ts` — add S3 download logic when `DB_SOURCE=s3`
- `server/index.ts` — add `/health` endpoint
- `package.json` — add deploy scripts
- `.gitignore` — add deploy.config.json
- `vite.config.ts` — production adjustments (optional, may use env-based config)

## Notes
- DuckDB file is ~158MB. S3 transfer within same region to EC2 is fast (~2-3s). Cross-region or to App Runner may take longer.
- Consider adding a "last updated" indicator in the frontend that reads from the DuckDB metadata or a sidecar file in S3.
- Future optimization: if DuckDB grows too large, consider DuckDB's native S3/httpfs extension to read directly from S3 without downloading (requires DuckDB httpfs extension, may add query latency).
- The `/api/trade2` proxy to pathofexile.com needs a solution in production — either CloudFront proxies it, or the client calls GGG directly (may have CORS issues). CloudFront with a custom origin for `pathofexile.com` is cleanest.
- EC2 SSH key stored at: `.kiro/poe2-explorer-key.pem` (gitignored via *.pem)
