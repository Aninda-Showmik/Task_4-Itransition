// middleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) {
        return res.status(403).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, 'Nataraz');
        console.log('Decoded User:', decoded); // Logs the decoded token information
 // Use the same secret as in the login route
        req.user = decoded; // Add decoded info to request object
        next();
    } catch (err) {
        return res.status(400).json({ error: 'Invalid token.' });
    }
};

module.exports = authenticateToken; // Export the function directly
