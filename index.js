const AWS = require('aws-sdk');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const {
      AWS_REGION='us-east-1',
      INSTANCE_ID,
      HEALTH_URL,
      BACKEND_API_URL
    } = process.env;

    const ec2 = new AWS.EC2({ region: AWS_REGION });

    const body = JSON.parse(event.body);
    const { user_id, instance_type, ami_id } = body;

    // 1. Describe instance
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
    const timeout = Date.now() + 3 * 60 * 1000; // 3 minutes
    let healthy = false;

    while (Date.now() < timeout) {
      try {
        const health = await fetch(HEALTH_URL);
        if (health.ok) {
          healthy = true;
          break;
        }
      } catch (_) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!healthy) {
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
