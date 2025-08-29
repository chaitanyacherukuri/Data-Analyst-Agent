# GitHub Actions Workflows

## Render Smoke Test Workflow

The `render-smoke.yml` workflow is designed to keep your Render service warm and prevent cold starts on the free plan.

### Features

- **Scheduled Execution**: Runs automatically every 15 minutes
- **Manual Trigger**: Can be triggered manually via GitHub Actions UI
- **Deployment Health Check**: Validates service after deployments
- **Robust Retry Logic**: 30 retries with 10-second delays

### Setup Instructions

#### 1. Set Repository Secret

For the scheduled runs to work, you need to set your Render backend URL as a repository secret:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `RENDER_BACKEND_URL`
5. Value: Your Render service URL (e.g., `https://your-service.onrender.com`)

#### 2. Enable GitHub Actions

Ensure GitHub Actions are enabled for your repository:

1. Go to **Settings** → **Actions** → **General**
2. Make sure "Allow all actions and reusable workflows" is selected

### How It Works

#### Triggers

1. **Schedule**: Every 15 minutes (`*/15 * * * *`)
2. **Manual**: Via GitHub Actions UI with custom backend URL
3. **Repository Dispatch**: Triggered after successful deployments

#### Execution

1. Checks out the repository code
2. Sets up Python 3.11 environment
3. Validates backend URL is available
4. Runs smoke test against `/ping` endpoint
5. Retries up to 30 times if needed

### Monitoring

You can monitor the workflow execution:

1. Go to **Actions** tab in your repository
2. Click on "Render Deploy Smoke Test"
3. View recent runs and their status

### Troubleshooting

#### Common Issues

1. **"No backend URL provided"**: Set the `RENDER_BACKEND_URL` secret
2. **Service not responding**: Check if your Render service is deployed correctly
3. **Rate limiting**: The workflow respects GitHub Actions limits (2000 minutes/month for free)

#### Adjusting Frequency

To change the schedule frequency, edit the cron expression in `render-smoke.yml`:

```yaml
schedule:
  - cron: '*/10 * * * *'  # Every 10 minutes
  - cron: '0 */2 * * *'   # Every 2 hours
  - cron: '*/5 * * * *'   # Every 5 minutes (not recommended - may hit rate limits)
```

### Cost Considerations

- GitHub Free plan: 2000 minutes/month
- Running every 15 minutes ≈ 1440 minutes/month (well within limits)
- Render Free plan: This keeps your service active and responsive

### Alternative Solutions

If you upgrade to Render's paid plan, you won't need this workflow as paid services don't sleep after inactivity.
