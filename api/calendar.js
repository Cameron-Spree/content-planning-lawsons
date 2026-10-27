const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'calendar.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json(data);
    }
    return res.status(404).json({ error: 'Calendar data not found. Please run the processing pipeline first.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
