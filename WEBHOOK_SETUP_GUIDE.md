# Stripe Webhook Local Testing Setup with ngrok

This guide will help you set up and test Stripe webhooks locally using ngrok.

## Prerequisites

1. **ngrok installed**: Download from https://ngrok.com/download
2. **Stripe CLI** (optional but recommended): https://stripe.com/docs/stripe-cli
3. **Environment variables configured**

## Step 1: Install ngrok

### Option A: Download Binary

1. Go to https://ngrok.com/download
2. Download the version for your OS
3. Extract and add to your PATH

### Option B: Using Package Managers

```bash
# macOS (Homebrew)
brew install ngrok/ngrok/ngrok

# Linux (Snap)
sudo snap install ngrok

# Windows (Chocolatey)
choco install ngrok
```

## Step 2: Create ngrok Account and Get Auth Token

1. Sign up at https://dashboard.ngrok.com/signup
2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok with your auth token:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Step 3: Start Your Local Server

Make sure your Node.js server is running:

```bash
# In your contacts-api directory
npm run dev
# or
node index.js
```

Your server should be running on `http://localhost:PORT` (check your .env file for the PORT value).

## Step 4: Create ngrok Tunnel

Open a new terminal and create a tunnel to your local server:

```bash
# Replace 3000 with your actual PORT from .env
ngrok http 3000
```

You'll see output like:

```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abcd1234.ngrok.io -> http://localhost:3000
```

**Important**: Copy the HTTPS forwarding URL (e.g., `https://abcd1234.ngrok.io`)

## Step 5: Configure Stripe Webhook Endpoint

1. Go to your Stripe Dashboard: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://YOUR_NGROK_URL.ngrok.io/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
5. Click "Add endpoint"

## Step 6: Get Webhook Secret

1. In the Stripe Dashboard, click on your newly created webhook endpoint
2. Click "Reveal" in the "Signing secret" section
3. Copy the webhook signing secret (starts with `whsec_`)

## Step 7: Update Environment Variables

Add the webhook secret to your `.env` file:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here
```

**Important**: Restart your Node.js server after adding the environment variable.

## Step 8: Test the Webhook

### Method 1: Create a Test Checkout Session

1. Use your frontend application or API to create a checkout session
2. Complete the payment using Stripe's test card numbers
3. Check your server logs for webhook processing messages

### Method 2: Use Stripe CLI (Recommended)

```bash
# Forward webhook events to your local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

### Method 3: Manual Testing via Stripe Dashboard

1. Go to your webhook endpoint in Stripe Dashboard
2. Click "Send test webhook"
3. Select `checkout.session.completed` event
4. Send the test event

## Step 9: Monitoring and Debugging

### View ngrok Web Interface

Visit `http://127.0.0.1:4040` in your browser to see:

- Incoming requests
- Request/response details
- Replay requests for debugging

### Check Server Logs

Monitor your Node.js console for webhook processing logs:

```
🔔 Processing checkout.session.completed webhook: cs_test_...
✅ Webhook signature verified
📝 Processing subscription for user ... with plan ...
✅ Webhook processing completed successfully
```

### Verify Webhook Delivery in Stripe

1. Go to your webhook endpoint in Stripe Dashboard
2. Check the "Recent deliveries" section
3. Click on individual events to see status and response

## Test Card Numbers

Use these test card numbers for testing:

- **Successful payment**: `4242424242424242`
- **Declined payment**: `4000000000000002`
- **Requires authentication**: `4000002500003155`

## Troubleshooting

### Common Issues

1. **Webhook signature verification failed**

   - Ensure `STRIPE_WEBHOOK_SECRET` is correctly set
   - Restart your server after updating environment variables
   - Make sure you're using the webhook secret (not API keys)

2. **ngrok tunnel not working**

   - Check if ngrok is authenticated: `ngrok config check`
   - Try using a different port: `ngrok http 8000`
   - Restart ngrok tunnel

3. **Webhook not receiving events**

   - Verify the ngrok URL is correct in Stripe Dashboard
   - Check that your server is running on the correct port
   - Ensure the webhook route is properly configured

4. **Multiple subscription processing**
   - This is expected behavior - the idempotency protection will handle it
   - Check logs for "Session already processed" messages

### Debug Commands

```bash
# Check ngrok status
ngrok status

# Test webhook endpoint directly
curl -X POST https://YOUR_NGROK_URL.ngrok.io/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# View ngrok configuration
ngrok config check
```

## Production Deployment

When deploying to production:

1. **Update webhook URL** in Stripe Dashboard to your production domain
2. **Use production webhook secret** in environment variables
3. **Remove ngrok** dependency
4. **Set up proper error handling** and monitoring
5. **Consider webhook retry logic** for failed processing

## Security Notes

- Never commit webhook secrets to version control
- Use HTTPS in production (ngrok provides HTTPS automatically)
- Validate webhook signatures on every request
- Implement proper error handling and logging
- Consider rate limiting for webhook endpoints

## Example .env Configuration

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_URL=mongodb://localhost:27017/your-database

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

This setup ensures that your subscription completion logic runs reliably, even if users close their browser before reaching the PaymentSuccess page.
