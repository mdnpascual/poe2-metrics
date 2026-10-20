# EC2 Instance Configuration Backup

Captured: 2026-08-11 (before termination)

> TODO: resource IDs below are redacted placeholders. Update them when redeploying
> (the real values are produced by `provision-ec2.ps1` / your AWS console).

## Instance Details

| Property | Value |
|----------|-------|
| Instance ID | i-xxxxxxxxxxxxxxxxx (terminated) |
| Instance Type | t3.micro |
| AMI | ami-xxxxxxxxxxxxxxxxx |
| OS | Amazon Linux 2023 |
| Region / AZ | us-east-1 / us-east-1d |
| VPC | vpc-xxxxxxxxxxxxxxxxx |
| Subnet | subnet-xxxxxxxxxxxxxxxxx |
| Key Pair | poe2-explorer-key |
| Node.js | v20.20.2 |

## Security Group: poe2-explorer-sg (sg-xxxxxxxxxxxxxxxxx)

**Inbound:**
- TCP 22 (SSH) from <your-ip>/32
- TCP 4000 from CloudFront prefix list (pl-xxxxxxxx)

**Outbound:**
- All traffic to 0.0.0.0/0

## EBS Volume

| Property | Value |
|----------|-------|
| Volume ID | vol-xxxxxxxxxxxxxxxxx (deleted with instance) |
| Device | /dev/xvda (root) |
| DeleteOnTermination | true |

## Application Layout on Instance

```
/opt/poe2-explorer/
├── explorer_v2.duckdb    (158 MB - deployed from local)
├── node_modules/         (npm ci --production)
├── package.json
├── package-lock.json
└── server/
    ├── db.js
    ├── deploy.js
    ├── index.js
    ├── ingest.js
    ├── ingestv2.js
    ├── resolvers.js
    └── schema.js
```

## Service

- Systemd unit: `/etc/systemd/system/poe2-explorer.service`
- See `poe2-explorer.service` in this directory
- No .env file (env vars set in systemd unit)
- No nginx (Node serves directly on port 4000, CloudFront fronts it)

## CloudFront

- Distribution ID: EXXXXXXXXXXXXX
- Domain: xxxxxxxxxxxxxx.cloudfront.net
- Origin: EC2 public DNS on port 4000 (path pattern: /graphql)
- Alternate domain name: `poe2metrics.mduh.dev` (Route 53 alias `A`/`AAAA` in the `mduh.dev` zone, `<hosted-zone-id>`)
- Certificate: ACM in `us-east-1` (`arn:aws:acm:us-east-1:<account-id>:certificate/<id>`), DNS-validated, SNI only, minimum `TLSv1.2_2021`
- Viewer-request function `poe2-explorer-host-redirect` on the default (S3 SPA) behavior only: GET/HEAD on any other host (the old `*.cloudfront.net` URL) gets a 301 to `https://poe2metrics.mduh.dev`. `/graphql` and `/api/trade2/*` have no function and serve on both hosts.
- Set up by `aws-infra/add-custom-domain.ps1` (idempotent, `-DryRun`). `aws-start.ps1` round-trips the whole config, so the alias and certificate survive it.
