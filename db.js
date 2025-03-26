const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',      // Change if needed
    user: 'root',          // Your MySQL username
    password: '182001612',          // Your MySQL password (empty if none)
    database: 'user_management' // The database we created
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL database');
    }
});

module.exports = db;
