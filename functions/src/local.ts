// Local server for `npm run dev` / `npm start`. Not part of the deployed function.
import { createApp } from './app';

const port = Number(process.env.PORT) || 8787;
createApp().listen(port, () => console.log(`FormSure on http://localhost:${port}`));
