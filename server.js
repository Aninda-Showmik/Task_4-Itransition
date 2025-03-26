require('dotenv').config({ path: './secret.env' }); // Load the secret.env file

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Importing the db.js file
const authenticateToken = require('./middleware'); // Importing the middleware for token authentication

const app = express();
const port = 5000;

// Middleware to parse incoming JSON requests
app.use(express.json());

// Enable CORS for all domains (you can customize this later)
app.use(cors());

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Check if email already exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (err) {
            console.error('Database error:', err); // Log the error
            return res.status(500).json({ error: 'Database error' });
        }

        // If result is not empty, it means the email already exists
        if (result.length > 0) {
            return res.status(400).json({ error: 'Email already exists' }); // Corrected error message
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], (err) => {
            if (err) {
                console.error('Error creating user:', err); // Log the error
                return res.status(500).json({ error: 'Error creating user' });
            }

            return res.status(201).json({ message: 'User registered successfully' });
        });
    });
});

// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both email and password' });
    }

    // Check if the user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = result[0];

        // Check if the user is blocked
        if (user.status === 'blocked') {
            return res.status(403).json({ error: 'You are blocked. Contact with the Admin!' });
        }

        // Compare the password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'Nataraz', { expiresIn: '1h' });

        // Update last login timestamp
        db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id], (updateErr) => {
            if (updateErr) console.error('Failed to update last login:', updateErr);
        });

        return res.json({ message: 'Login successful', token });
    });
});

// Middleware to check if the user is blocked
function checkUserStatus(req, res, next) {
    const userId = req.user.userId;

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result[0];

        if (user.status === 'blocked') {
            return res.status(403).json({ error: 'User is blocked' }); // 🚀 Stops execution
        }

        next(); // ✅ Only proceeds if the user is NOT blocked
    });

    console.log('Authenticated user ID:', req.user.userId);
}

// Route to fetch users
app.get('/users', authenticateToken, checkUserStatus, (req, res) => {
    db.query('SELECT * FROM users ORDER BY last_login DESC', (err, results) => {
        if (err) {
            console.error('Database error:', err); // Log the error
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results); // Send the list of users
    });
});

app.post('/users/block', authenticateToken, checkUserStatus, (req, res) => {
    const { userIds } = req.body; // Array of user IDs to block
    const loggedInUserId = req.user.userId; // Get the logged-in user's ID

    // Check if userIds is empty
    if (!userIds || userIds.length === 0) {
        return res.status(400).json({ error: 'No users selected' });
    }

    db.query('UPDATE users SET status = "blocked" WHERE id IN (?)', [userIds], (err) => {
        if (err) {
            console.error('Failed to block users:', err);
            return res.status(500).json({ error: 'Failed to block users' });
        }

        // 🚀 If the logged-in user is in the blocked list, send a logout response
        if (userIds.includes(loggedInUserId)) {
            return res.status(200).json({ message: 'You have been blocked and logged out', logout: true });
        }

        res.status(200).json({ message: 'Users blocked successfully' });
    });
});

// Route to unblock users
app.post('/users/unblock', authenticateToken, checkUserStatus, (req, res) => {
    const { userIds } = req.body; // Array of selected user IDs to unblock

    // Validate if userIds is a non-empty array
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'No valid user IDs provided for unblocking' });
    }

    // Perform the status update
    db.query('UPDATE users SET status = "active" WHERE id IN (?)', [userIds], (err) => {
        if (err) {
            console.error('Failed to unblock users:', err); // Log the error
            return res.status(500).json({ error: 'Failed to unblock users' });
        }
        res.status(200).json({ message: 'Users unblocked successfully' });
    });
});

// Route to delete users
app.post('/users/delete', authenticateToken, checkUserStatus, (req, res) => {
    const { userIds } = req.body; // Array of selected user IDs to delete
    console.log('Received user IDs to delete:', userIds); // Log the received user IDs

    if (userIds && userIds.length > 0) {
        // Delete users from the database using DELETE query
        db.query('DELETE FROM users WHERE id IN (?)', [userIds], (err, result) => {
            if (err) {
                console.error('Error deleting users:', err);
                return res.status(500).json({ error: 'Error deleting users' });
            }
            return res.status(200).json({ message: 'Users deleted successfully' });
        });
    } else {
        return res.status(400).json({ error: 'No users selected for deletion' });
    }
});

// Start server and listen on port 5000
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});