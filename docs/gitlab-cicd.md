# GitLab CI/CD Setup

The pipeline in `.gitlab-ci.yml` validates every branch and deploys from the default branch.

## Immediate Security Step

If an AWS access key was pasted into chat, delete it in AWS IAM and create a replacement key before
adding CI/CD variables.

AWS path:

1. IAM -> Users -> `graphflow-cli`
2. Security credentials
3. Deactivate/delete the exposed access key
4. Create a new access key for CI/CD

## GitLab Variables

In GitLab:

1. Open the project.
2. Go to **Settings -> CI/CD -> Variables**.
3. Add these variables.
4. Use **Masked and hidden** for secrets.
5. Use **Protected** if your default branch is protected.

Required variables:

| Key | Value | Secret |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | New AWS access key ID | Yes |
| `AWS_SECRET_ACCESS_KEY` | New AWS secret access key | Yes |
| `AWS_DEFAULT_REGION` | `us-east-1` | No |
| `AWS_REGION` | `us-east-1` | No |
| `VERCEL_TOKEN` | Vercel account token | Yes |
| `VERCEL_ORG_ID` | Vercel project metadata from `vercel link` | No |
| `VERCEL_PROJECT_ID` | Vercel project metadata from `vercel link` | No |

## Vercel IDs

From the project folder, after logging in locally:

```bash
vercel login
vercel link
```

This creates `.vercel/project.json`. Copy the required Vercel project metadata into GitLab
variables only.

Do not commit `.vercel/`; it is already ignored.

Create a Vercel token:

1. Vercel dashboard -> Account Settings -> Tokens
2. Create token
3. Add it to GitLab as `VERCEL_TOKEN`

## Pipeline Behavior

Every branch:

- `npm ci`
- `npm run lint`
- `npm run build`

Default branch only:

- Deploys CloudFormation stack from `infra/graphflow-foundation.yaml`
- Seeds DynamoDB demo data
- Deploys the Next.js app to Vercel production

## First Push Flow

```bash
git add .
git commit -m "Add GraphFlow CI/CD deployment"
git push origin main
```

Then open GitLab -> Build -> Pipelines and watch the jobs.
