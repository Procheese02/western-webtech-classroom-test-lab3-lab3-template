const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const SIGNUPS_FILE = path.join(DATA_DIR, 'signups.json');
const GRADES_FILE = path.join(DATA_DIR, 'grades.json');

// Initialize data directory and files
function initializeDataFiles() {
    if (!fsSync.existsSync(DATA_DIR)) {
        fsSync.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (!fsSync.existsSync(COURSES_FILE)) {
        fsSync.writeFileSync(COURSES_FILE, JSON.stringify({ courses: [], members: [] }, null, 2));
    }
    
    if (!fsSync.existsSync(SIGNUPS_FILE)) {
        fsSync.writeFileSync(SIGNUPS_FILE, JSON.stringify({ 
            signupSheets: [], 
            slots: [], 
            signups: [],
            nextSheetId: 1,
            nextSlotId: 1
        }, null, 2));
    }
    
    if (!fsSync.existsSync(GRADES_FILE)) {
        fsSync.writeFileSync(GRADES_FILE, JSON.stringify({ grades: [] }, null, 2));
    }
}

async function readData(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${file}:`, error);
        return null;
    }
}

async function writeData(file, data) {
    try {
        await fs.writeFile(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${file}:`, error);
        return false;
    }
}

// Input sanitization functions
function sanitizeString(str, maxLength) {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).trim();
}

function sanitizeNumber(num, min, max, defaultVal = 0) {
    const parsed = parseInt(num);
    if (isNaN(parsed)) return defaultVal;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
}

function validateTimestamp(timestamp) {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
}

// ============ COURSE MANAGEMENT ROUTES ============

// Create a course
app.post('/api/courses', async (req, res) => {
    try {
        const { termCode, courseName, section = 1 } = req.body;
        
        // Validate required parameters
        if (!termCode || !courseName) {
            return res.status(400).json({ error: 'Missing required parameters: termCode and courseName are required' });
        }
        
        // Sanitize inputs
        const sanitizedTermCode = sanitizeNumber(termCode, 1, 9999);
        const sanitizedCourseName = sanitizeString(courseName, 100);
        const sanitizedSection = sanitizeNumber(section, 1, 99, 1);
        
        if (sanitizedTermCode === 0) {
            return res.status(400).json({ error: 'Invalid term code. Must be between 1 and 9999' });
        }
        
        if (!sanitizedCourseName) {
            return res.status(400).json({ error: 'Course name cannot be empty' });
        }
        
        const data = await readData(COURSES_FILE);
        
        // Check if course already exists
        const exists = data.courses.some(c => 
            c.termCode === sanitizedTermCode && c.section === sanitizedSection
        );
        
        if (exists) {
            return res.status(409).json({ 
                error: `Course with term code ${sanitizedTermCode} and section ${sanitizedSection} already exists` 
            });
        }
        
        // Add course
        data.courses.push({
            termCode: sanitizedTermCode,
            courseName: sanitizedCourseName,
            section: sanitizedSection,
            createdAt: new Date().toISOString()
        });
        
        await writeData(COURSES_FILE, data);
        
        res.status(201).json({ 
            message: 'Course created successfully',
            course: { termCode: sanitizedTermCode, courseName: sanitizedCourseName, section: sanitizedSection }
        });
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get the list of courses
app.get('/api/courses', async (req, res) => {
    try {
        const data = await readData(COURSES_FILE);
        res.json(data.courses || []);
    } catch (error) {
        console.error('Error getting courses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a course
app.delete('/api/courses/:termCode/:section?', async (req, res) => {
    try {
        const termCode = sanitizeNumber(req.params.termCode, 1, 9999);
        const section = sanitizeNumber(req.params.section, 1, 99, 1);
        
        const data = await readData(COURSES_FILE);
        
        const courseIndex = data.courses.findIndex(c => 
            c.termCode === termCode && c.section === section
        );
        
        if (courseIndex === -1) {
            return res.status(404).json({ 
                error: `Course with term code ${termCode} and section ${section} does not exist` 
            });
        }
        
        // Remove course and associated members
        data.courses.splice(courseIndex, 1);
        data.members = data.members.filter(m => 
            !(m.termCode === termCode && m.section === section)
        );
        
        await writeData(COURSES_FILE, data);
        
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add members to a course
app.post('/api/courses/:termCode/:section?/members', async (req, res) => {
    try {
        const termCode = sanitizeNumber(req.params.termCode, 1, 9999);
        const section = sanitizeNumber(req.params.section, 1, 99, 1);
        const { members } = req.body;
        
        if (!members || !Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ error: 'Members array is required and must not be empty' });
        }
        
        const data = await readData(COURSES_FILE);
        
        // Check if course exists
        const courseExists = data.courses.some(c => 
            c.termCode === termCode && c.section === section
        );
        
        if (!courseExists) {
            return res.status(404).json({ 
                error: `Course with term code ${termCode} and section ${section} does not exist` 
            });
        }
        
        let addedCount = 0;
        const ignoredIds = [];
        
        members.forEach(member => {
            const sanitizedId = sanitizeString(member.memberId, 8);
            const sanitizedFirstName = sanitizeString(member.firstName, 200);
            const sanitizedLastName = sanitizeString(member.lastName, 200);
            const sanitizedRole = sanitizeString(member.role, 10);
            
            if (!sanitizedId || sanitizedId.length !== 8) {
                ignoredIds.push(member.memberId || 'invalid');
                return;
            }
            
            // Check if member already exists
            const exists = data.members.some(m => 
                m.termCode === termCode && m.section === section && m.memberId === sanitizedId
            );
            
            if (exists) {
                ignoredIds.push(sanitizedId);
            } else {
                data.members.push({
                    termCode,
                    section,
                    memberId: sanitizedId,
                    firstName: sanitizedFirstName,
                    lastName: sanitizedLastName,
                    role: sanitizedRole || 'student',
                    addedAt: new Date().toISOString()
                });
                addedCount++;
            }
        });
        
        await writeData(COURSES_FILE, data);
        
        res.status(201).json({ 
            message: `${addedCount} member(s) added successfully`,
            addedCount,
            ignoredIds
        });
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get the list of members
app.get('/api/courses/:termCode/:section?/members', async (req, res) => {
    try {
        const termCode = sanitizeNumber(req.params.termCode, 1, 9999);
        const section = sanitizeNumber(req.params.section, 1, 99, 1);
        const role = sanitizeString(req.query.role, 10).toLowerCase();
        
        const data = await readData(COURSES_FILE);
        
        let members = data.members.filter(m => 
            m.termCode === termCode && m.section === section
        );
        
        if (role) {
            members = members.filter(m => m.role.toLowerCase() === role);
        }
        
        res.json(members);
    } catch (error) {
        console.error('Error getting members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a list of members
app.delete('/api/courses/:termCode/:section?/members', async (req, res) => {
    try {
        const termCode = sanitizeNumber(req.params.termCode, 1, 9999);
        const section = sanitizeNumber(req.params.section, 1, 99, 1);
        const { memberIds } = req.body;
        
        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ error: 'memberIds array is required and must not be empty' });
        }
        
        const data = await readData(COURSES_FILE);
        
        const initialLength = data.members.length;
        data.members = data.members.filter(m => 
            !(m.termCode === termCode && m.section === section && memberIds.includes(m.memberId))
        );
        
        const deletedCount = initialLength - data.members.length;
        
        await writeData(COURSES_FILE, data);
        
        res.json({ 
            message: `${deletedCount} member(s) deleted successfully`,
            deletedCount
        });
    } catch (error) {
        console.error('Error deleting members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize data files and start server
initializeDataFiles();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
module.exports = app;