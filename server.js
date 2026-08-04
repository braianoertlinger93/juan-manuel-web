'use strict';

// Servidor local de desarrollo/producción.
// Levanta la misma app de Express que usa Vercel (api/app.js).

const app = require('./api/app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('----------------------------------------------');
  console.log(' Sitio:      http://localhost:' + PORT);
  console.log(' Admin:      http://localhost:' + PORT + '/admin');
  console.log('----------------------------------------------');
  if (!process.env.SUPABASE_URL) {
    console.log(' AVISO: SUPABASE_URL no está configurada.');
    console.log('        Copiá ".env.example" a ".env" y completá tus credenciales.');
  }
});
