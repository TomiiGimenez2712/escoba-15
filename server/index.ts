import { createServerApp } from './app';

const port = Number(process.env.PORT) || 3001;
const { httpServer } = createServerApp();

httpServer.listen(port, () => {
  console.log(`Servidor Escoba 15 escuchando en http://localhost:${port}`);
});
