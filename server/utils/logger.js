export const logger = {
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, {
      timestamp: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack
    });
  },
  
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  },
  
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }
};

export default logger; 