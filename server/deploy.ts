import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve("deploy.config.json");

interface DeployConfig {
	awsRegion: string;
	s3Bucket: string;
	cloudfrontDistributionId: string;
	dbS3Key: string;
	backendServiceName: string;
}

function loadConfig(): DeployConfig {
	if (!existsSync(CONFIG_PATH)) {
		console.error(
			"❌ deploy.config.json not found. Copy deploy.config.example.json and fill in your values.",
		);
		process.exit(1);
	}
	return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function run(cmd: string, env?: Record<string, string>) {
	console.log(`  $ ${cmd}`);
	execSync(cmd, {
		stdio: "inherit",
		env: { ...process.env, ...env },
	});
}

export function deployFrontend() {
	const config = loadConfig();
	console.log("\n🚀 Deploying frontend...\n");

	// Build
	console.log("📦 Building frontend...");
	run("npx vite build");

	// Upload to S3
	console.log(`\n☁️  Syncing dist/ → s3://${config.s3Bucket}/frontend/`);
	run(
		`aws s3 sync dist/ s3://${config.s3Bucket}/frontend/ --delete --region ${config.awsRegion}`,
	);

	// Invalidate CloudFront
	console.log(`\n🔄 Invalidating CloudFront (${config.cloudfrontDistributionId})...`);
	run(
		`aws cloudfront create-invalidation --distribution-id ${config.cloudfrontDistributionId} --paths "/*" --region ${config.awsRegion}`,
	);

	console.log("\n✅ Frontend deployed!\n");
}

export function deployDb() {
	const config = loadConfig();
	const dbPath = path.resolve("explorer_v2.duckdb");

	if (!existsSync(dbPath)) {
		console.error("❌ explorer_v2.duckdb not found in project root.");
		process.exit(1);
	}

	const sizeMB = (readFileSync(dbPath).length / 1024 / 1024).toFixed(1);
	console.log(`\n🚀 Uploading DuckDB (${sizeMB} MB)...\n`);
	console.log(`  Local:  ${dbPath}`);
	console.log(`  Remote: s3://${config.s3Bucket}/${config.dbS3Key}\n`);

	run(
		`aws s3 cp "${dbPath}" s3://${config.s3Bucket}/${config.dbS3Key} --region ${config.awsRegion}`,
	);

	console.log("\n✅ DuckDB uploaded!\n");
}

export function deployBackend() {
	const config = loadConfig();
	console.log("\n🚀 Restarting backend service...\n");

	// This assumes App Runner. Adjust for EC2 (SSM run-command) or ECS (force-new-deployment).
	try {
		run(
			`aws apprunner start-deployment --service-arn ${config.backendServiceName} --region ${config.awsRegion}`,
		);
	} catch {
		// Fallback: try ECS force-new-deployment
		console.log("  App Runner failed, trying ECS force-new-deployment...");
		try {
			run(
				`aws ecs update-service --cluster poe2-explorer --service ${config.backendServiceName} --force-new-deployment --region ${config.awsRegion}`,
			);
		} catch {
			console.error(
				"\n⚠️  Could not restart backend automatically.",
				"\n   If using EC2, SSH in and restart the service manually,",
				"\n   or update backendServiceName in deploy.config.json.\n",
			);
			process.exit(1);
		}
	}

	console.log("\n✅ Backend restarted!\n");
}

export function deployAll() {
	deployFrontend();
	deployDb();
	deployBackend();
}

// CLI entry point
const command = process.argv[2];
switch (command) {
	case "frontend":
		deployFrontend();
		break;
	case "db":
		deployDb();
		break;
	case "backend":
		deployBackend();
		break;
	case "all":
		deployAll();
		break;
	default:
		console.log("Usage: tsx server/deploy.ts <frontend|db|backend|all>");
		process.exit(1);
}
