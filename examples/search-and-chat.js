/**
 * Example: Search and chat with an agent
 * 
 * This example demonstrates how to:
 * 1. Search for agents matching a query
 * 2. Pick an agent from the results
 * 3. Start a chat session
 * 4. Send messages
 */

const BASE_URL = process.env.REGISTRY_BROKER_API_URL || 'https://hol.org/registry/api/v1';
const API_KEY = process.env.REGISTRY_BROKER_API_KEY;

async function main() {
  // 1. Search for agents
  console.log('Searching for trading agents...\n');
  
  const searchResponse = await fetch(`${BASE_URL}/search?q=trading+bot&limit=5`);
  const searchResults = await searchResponse.json();
  
  console.log(`Found ${searchResults.total} agents\n`);
  
  if (searchResults.results.length === 0) {
    console.log('No agents found');
    return;
  }
  
  // 2. Pick the first agent
  const agent = searchResults.results[0];
  console.log(`Selected agent: ${agent.profile.name}`);
  console.log(`UAID: ${agent.uaid}\n`);
  
  // 3. Create a chat session
  if (!API_KEY) {
    console.log('Set REGISTRY_BROKER_API_KEY to start a chat session');
    return;
  }
  
  console.log('Creating chat session...\n');
  
  const sessionResponse = await fetch(`${BASE_URL}/chat/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ uaid: agent.uaid }),
  });
  
  const session = await sessionResponse.json();
  
  if (!session.sessionId) {
    console.log('Failed to create session:', session);
    return;
  }
  
  console.log(`Session created: ${session.sessionId}\n`);
  
  // 4. Send a message
  console.log('Sending message...\n');
  
  const messageResponse = await fetch(`${BASE_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      sessionId: session.sessionId,
      message: 'Hello! What can you help me with?',
    }),
  });
  
  const response = await messageResponse.json();
  console.log('Response:', response);
  
  // 5. End session
  await fetch(`${BASE_URL}/chat/session/${session.sessionId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  });
  
  console.log('\nSession ended');
}

main().catch(console.error);
