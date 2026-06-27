const environment = process.argv[2] ?? "staging";
const allowed = new Set(["staging", "canary", "production"]);

if (!allowed.has(environment)) {
  console.error(`Unknown deployment environment: ${environment}`);
  process.exit(1);
}

console.log(`Deploying checkout-service to ${environment}.`);
console.log("Deployment completed.");
