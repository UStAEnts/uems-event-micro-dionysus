import { app } from './app';
import { createServer } from 'http';

import debugObj = require('debug');

/**
 * Create a debug instance for the microservice
 */
const debug = debugObj('uems-event-micro-dionysus:server');

function normalisePort(val: string): string | number | false {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        return val;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}

function onError(error: any) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    let bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    let addr = server.address();

    let bind;

    if (addr === null) {
        bind = 'null value';
    } else if (typeof (addr) === "string") {
        bind = `pipe ${addr}`;
    } else {
        bind = `port ${addr.port}`;
    }

    debug('Listening on ' + bind);
}

const port = normalisePort(process.env.PORT || '3000');
app.set('port', port);

const server = createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
