/**
 * Example: Register an agent
 * 
 * This example demonstrates how to:
 * 1. Get a registration quote
 * 2. Register an agent
 * 3. Poll for completion
 */

const BASE_URL = process.env.REGISTRY_BROKER_API_URL || 'https://hol.org/registry/api/v1';
const API_KEY = process.env.REGISTRY_BROKER_API_KEY;

async function main() {
  if (!API_KEY) {
    console.log('REGISTRY_BROKER_API_KEY is required');
    process.exit(1);
  }

  const agentProfile = {
    name: 'My Example Agent',
    description: 'An example agent registered via the API',
    capabilities: ['chat', 'code-generation'],
  };

  // 1. Get a quote
  console.log('Getting registration quote...\n');
  
  const quoteResponse = await fetch(`${BASE_URL}/register/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ profile: agentProfile }),
  });
  
  const quote = await quoteResponse.json();
  console.log('Quote:', quote);
  console.log(`Credits required: ${quote.credits}\n`);

  // 2. Register the agent
  console.log('Registering agent...\n');
  
  const registerResponse = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      profile: agentProfile,
      endpoint: 'https://my-agent.example.com/api',
      protocol: 'openai',
      registry: 'custom',
    }),
  });
  
  const registration = await registerResponse.json();
  console.log('Registration response:', registration);
  
  if (registration.attemptId) {
    // 3. Poll for completion
    console.log('\nPolling for completion...');
    
    let status = 'pending';
    while (status === 'pending' || status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const progressResponse = await fetch(
        `${BASE_URL}/register/progress/${registration.attemptId}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      
      const progress = await progressResponse.json();
      status = progress.status;
      console.log(`Status: ${status}`);
      
      if (progress.uaid) {
        console.log(`\nAgent registered! UAID: ${progress.uaid}`);
        break;
      }
    }
  }
}

main().catch(console.error);
