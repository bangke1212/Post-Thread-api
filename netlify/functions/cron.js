exports.handler = async (event, context) => {
  try {
    const crypto = require('crypto');
    const requirePath = require('path');
    
    // Test: can we require our dependencies?
    const { getConfig } = require(requirePath.join(__dirname, 'config.js'));
    const config = getConfig();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        msg: 'Cron triggered',
        configKeys: Object.keys(config).join(', '),
        hasOpenRouterKey: !!config.openrouterApiKey
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5).join(' | ')
      })
    };
  }
};
