import { app } from './app';
import { config } from './config';
import { initDb } from './db';

await initDb();

app.listen(config.port, () => {
	console.log(`SipiRider API listening on http://localhost:${config.port}`);
});
