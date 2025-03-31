#!/usr/bin/env python

import os
import logging
from api import create_app

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger('db_simulator')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app = create_app()
    logger.info(f"Starting API server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True) 