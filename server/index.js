const express = require('express');
const cors = require('cors');
const configRoutes = require('./routes/config');
const playerRoutes = require('./routes/players');
const draftRoutes = require('./routes/draft');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/config', configRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/draft', draftRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
