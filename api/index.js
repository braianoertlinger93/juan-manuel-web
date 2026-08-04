'use strict';

// Entrada para Vercel (serverless). Vercel importa la app de Express
// y la expone como función sin servidor. Express queda como handler.
const app = require('./app');

module.exports = app;
