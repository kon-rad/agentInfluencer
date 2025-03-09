// Default tools configuration for agents
const defaultTools = [
  {
    tool_name: "create_short_form_video",
    description: "Creates a short-form video for social media marketing campaigns",
    parameters: JSON.stringify({
      prompt: "string - Description of the video content to generate"
    }),
    usage_format: "ACTION: create_short_form_video\nPARAMETERS: {\n  \"prompt\": \"Create an engaging 30-second video about Base L2's latest features\"\n}\nREASON: To generate engaging social media content about Base L2"
  },
  {
    tool_name: "CreateBountyTool",
    description: "Creates a new bounty for content creators and posts it to Twitter",
    parameters: JSON.stringify({
      title: "string - The title of the bounty",
      description: "string - Detailed description of what the bounty requires",
      reward: "string - The reward amount (e.g., '0.0000001 ETH')",
      deadline: "string - Deadline in ISO format (e.g., '2023-12-31T23:59:59Z')"
    }),
    usage_format: "ACTION: CreateBountyTool\nPARAMETERS: {\n  \"title\": \"Create a tutorial about Base L2\",\n  \"description\": \"Create a 5-minute video explaining how to deploy a smart contract on Base\",\n  \"reward\": \"0.1 ETH\",\n  \"deadline\": \"2023-12-31T23:59:59Z\"\n}\nREASON: To incentivize content creation about Base L2 deployment"
  },
  {
    tool_name: "TwitterPostTool",
    description: "Posts a tweet to the agent's Twitter account",
    parameters: JSON.stringify({
      content: "string - The content of the tweet (max 280 characters)",
      media_urls: "array - Optional array of media URLs to attach to the tweet"
    }),
    usage_format: "ACTION: TwitterPostTool\nPARAMETERS: {\n  \"content\": \"Exciting news from Base L2! Check out our latest update on zero-knowledge proofs.\",\n  \"media_urls\": [\"https://example.com/image.jpg\"]\n}\nREASON: To share important updates with the developer community"
  },
  {
    tool_name: "CheckBountySubmissionsTool",
    description: "Checks Twitter for replies to a bounty tweet and evaluates if they meet the requirements",
    parameters: JSON.stringify({
      tweet_id: "string - The ID of the original bounty tweet",
      requirements: "array - List of requirements that submissions must meet"
    }),
    usage_format: "ACTION: CheckBountySubmissionsTool\nPARAMETERS: {\n  \"tweet_id\": \"1234567890\",\n  \"requirements\": [\"Must include a link to GitHub repo\", \"Must have at least 5 minutes of video content\"]\n}\nREASON: To evaluate submissions for the Base L2 tutorial bounty"
  },
  {
    tool_name: "SleepTool",
    description: "Makes the agent sleep for a specified duration before running again",
    parameters: JSON.stringify({
      milliseconds: "number - The duration to sleep in milliseconds (e.g., 3600000 for 1 hour)"
    }),
    usage_format: "ACTION: SleepTool\nPARAMETERS: {\n  \"milliseconds\": 3600000\n}\nREASON: To wait for 1 hour before checking for new content again"
  },
  {
    tool_name: "CryptoTransferTool",
    description: "Sends a small amount of MNT (0.0000001) to a specified address on Mantle network",
    parameters: JSON.stringify({
      recipient_address: "string - Optional recipient address (defaults to 0xa01dD443827F88Ba34FefFA8949144BaB122D736 if not provided)",
      network_id: "string - Optional network ID (defaults to 'mantle-testnet')"
    }),
    usage_format: "ACTION: CryptoTransferTool\nPARAMETERS: {\n  \"recipient_address\": \"0xa01dD443827F88Ba34FefFA8949144BaB122D736\",\n  \"network_id\": \"mantle-testnet\"\n}\nREASON: To send a small amount of MNT as a reward for completing a bounty"
  }
];

export default defaultTools; 