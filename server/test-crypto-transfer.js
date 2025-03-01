import toolRegistryService from './services/toolRegistryService.js';

async function testCryptoTransfer() {
  try {
    console.log('Initializing tool registry service...');
    await toolRegistryService.initialize();
    
    console.log('Available tools:', Array.from(toolRegistryService.tools.keys()));
    
    // Test the CryptoTransferTool with Base Sepolia testnet
    console.log('Testing CryptoTransferTool with Base Sepolia testnet...');
    const result = await toolRegistryService.executeTool('CryptoTransferTool', {
      recipient_address: '0xF6755901Cc97e967f2Ad3d3e877F3e1635Ce768e',
      network_id: 'base-sepolia'
    }, 1); // Using 1 as a dummy agent ID
    
    console.log('CryptoTransferTool result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error testing CryptoTransferTool:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

testCryptoTransfer(); 