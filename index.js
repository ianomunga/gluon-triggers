const AWS = require('aws-sdk');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const {
      AWS_REGION = 'us-east-1',
      INSTANCE_ID,
      HEALTH_URL,
      BACKEND_API_URL
    } = process.env;

    const ec2 = new AWS.EC2({ region: AWS_REGION });

    const body = JSON.parse(event.body);
    const { user_id } = body;

    const instance_type = 'g4dn.2xlarge';
    const ami_id = 'ami-0a7d80731ae1b2435';

    // 1. Describe the instance
    const descRes = await ec2.describeInstances({
      InstanceIds: [INSTANCE_ID]
    }).promise();

    const instanceState = descRes.Reservations[0].Instances[0].State.Name;
    console.log(`Instance state: ${instanceState}`);

    if (instanceState !== 'running') {
      console.log('Starting instance...');
      await ec2.startInstances({ InstanceIds: [INSTANCE_ID] }).promise();
    }

    // 2. Wait for health check
    const lambdaTimeoutRemaining = context.getRemainingTimeInMillis();
    const MAX_HEALTH_WAIT = Math.min(lambdaTimeoutRemaining - 10000, 7 * 60 * 1000);
    const timeout = Date.now() + MAX_HEALTH_WAIT;

    console.log(`Waiting for instance to become healthy (max wait: ${MAX_HEALTH_WAIT}ms)`);

    let healthy = false;
    while (Date.now() < timeout) {
      try {
        const healthRes = await fetch(HEALTH_URL);
        if (healthRes.ok) {
          healthy = true;
          console.log("Instance is healthy.");
          break;
        } else {
          console.log(`Health check failed with status: ${healthRes.status}`);
        }
      } catch (err) {
        console.log("Health check request failed (retrying)...", err.message);
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!healthy) {
      console.warn("Health check timed out.");
      return {
        statusCode: 504,
        body: 'Server did not become healthy in time.'
      };
    }

    // 3. Forward the request
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, instance_type, ami_id })
    });

    const responseText = await response.text();

    return {
      statusCode: response.status,
      body: responseText
    };

  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      body: `Error: ${err.message}`
    };
  }
};
