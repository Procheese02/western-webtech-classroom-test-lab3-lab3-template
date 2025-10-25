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

// ============ COURSE MANAGEMENT ============

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
// ============ SIGNUP SHEET MANAGEMENT ============

// Create a signup sheet
app.post('/api/signupsheets', async (req, res) => {
    try {
        const { termCode, section = 1, assignmentName, notBefore, notAfter } = req.body;
        
        if (!termCode || !assignmentName || !notBefore || !notAfter) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const sanitizedTermCode = sanitizeNumber(termCode, 1, 9999);
        const sanitizedSection = sanitizeNumber(section, 1, 99, 1);
        const sanitizedAssignment = sanitizeString(assignmentName, 100);
        
        if (sanitizedTermCode === 0) {
            return res.status(400).json({ error: 'Invalid term code' });
        }
        
        if (!sanitizedAssignment) {
            return res.status(400).json({ error: 'Assignment name cannot be empty' });
        }
        
        if (!validateTimestamp(notBefore) || !validateTimestamp(notAfter)) {
            return res.status(400).json({ error: 'Invalid timestamp format' });
        }
        
        const notBeforeDate = new Date(notBefore);
        const notAfterDate = new Date(notAfter);
        
        if (notBeforeDate >= notAfterDate) {
            return res.status(400).json({ error: 'Not-before must be earlier than not-after' });
        }
        
        const coursesData = await readData(COURSES_FILE);
        const courseExists = coursesData.courses.some(c => 
            c.termCode === sanitizedTermCode && c.section === sanitizedSection
        );
        
        if (!courseExists) {
            return res.status(404).json({ 
                error: `Course with term code ${sanitizedTermCode} and section ${sanitizedSection} does not exist` 
            });
        }
        
        const data = await readData(SIGNUPS_FILE);
        
        const newSheet = {
            id: data.nextSheetId,
            termCode: sanitizedTermCode,
            section: sanitizedSection,
            assignmentName: sanitizedAssignment,
            notBefore: notBeforeDate.toISOString(),
            notAfter: notAfterDate.toISOString(),
            createdAt: new Date().toISOString()
        };
        
        data.signupSheets.push(newSheet);
        data.nextSheetId++;
        
        await writeData(SIGNUPS_FILE, data);
        
        res.status(201).json({ 
            message: 'Signup sheet created successfully',
            signupSheet: newSheet
        });
    } catch (error) {
        console.error('Error creating signup sheet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a signup sheet
app.delete('/api/signupsheets/:id', async (req, res) => {
    try {
        const sheetId = sanitizeNumber(req.params.id, 1, 999999);
        
        const data = await readData(SIGNUPS_FILE);
        
        const sheetIndex = data.signupSheets.findIndex(s => s.id === sheetId);
        
        if (sheetIndex === -1) {
            return res.status(404).json({ error: 'Signup sheet not found' });
        }
        
        data.signupSheets.splice(sheetIndex, 1);
        data.slots = data.slots.filter(slot => slot.signupSheetId !== sheetId);
        data.signups = data.signups.filter(signup => signup.signupSheetId !== sheetId);
        
        await writeData(SIGNUPS_FILE, data);
        
        res.json({ message: 'Signup sheet deleted successfully' });
    } catch (error) {
        console.error('Error deleting signup sheet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get list of signup sheets for a course
app.get('/api/courses/:termCode/:section?/signupsheets', async (req, res) => {
    try {
        const termCode = sanitizeNumber(req.params.termCode, 1, 9999);
        const section = sanitizeNumber(req.params.section, 1, 99, 1);
        
        const data = await readData(SIGNUPS_FILE);
        
        const sheets = data.signupSheets.filter(s => 
            s.termCode === termCode && s.section === section
        );
        
        res.json(sheets);
    } catch (error) {
        console.error('Error getting signup sheets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ SLOT MANAGEMENT ============

// Add slots to a signup sheet
app.post('/api/signupsheets/:id/slots', async (req, res) => {
    try {
        const sheetId = sanitizeNumber(req.params.id, 1, 999999);
        const { start, slotDuration, numSlots, maxMembers } = req.body;
        
        if (!start || !slotDuration || !numSlots || !maxMembers) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const sanitizedDuration = sanitizeNumber(slotDuration, 1, 240);
        const sanitizedNumSlots = sanitizeNumber(numSlots, 1, 99);
        const sanitizedMaxMembers = sanitizeNumber(maxMembers, 1, 99);
        
        if (!validateTimestamp(start)) {
            return res.status(400).json({ error: 'Invalid timestamp format' });
        }
        
        const data = await readData(SIGNUPS_FILE);
        
        const sheet = data.signupSheets.find(s => s.id === sheetId);
        if (!sheet) {
            return res.status(404).json({ error: 'Signup sheet not found' });
        }
        
        const startDate = new Date(start);
        const newSlots = [];
        
        for (let i = 0; i < sanitizedNumSlots; i++) {
            const slotStart = new Date(startDate.getTime() + i * sanitizedDuration * 60000);
            
            const newSlot = {
                id: data.nextSlotId,
                signupSheetId: sheetId,
                startTime: slotStart.toISOString(),
                duration: sanitizedDuration,
                maxMembers: sanitizedMaxMembers,
                signedUpMembers: [],
                createdAt: new Date().toISOString()
            };
            
            data.slots.push(newSlot);
            newSlots.push(newSlot);
            data.nextSlotId++;
        }
        
        await writeData(SIGNUPS_FILE, data);
        
        res.status(201).json({ 
            message: 'Slots added successfully',
            slots: newSlots
        });
    } catch (error) {
        console.error('Error adding slots:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get list of slots for a signup sheet
app.get('/api/signupsheets/:id/slots', async (req, res) => {
    try {
        const sheetId = sanitizeNumber(req.params.id, 1, 999999);
        
        const data = await readData(SIGNUPS_FILE);
        
        const slots = data.slots.filter(s => s.signupSheetId === sheetId);
        
        res.json(slots);
    } catch (error) {
        console.error('Error getting slots:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Modify a slot
app.put('/api/slots/:id', async (req, res) => {
    try {
        const slotId = sanitizeNumber(req.params.id, 1, 999999);
        const { startTime, duration, maxMembers } = req.body;
        
        const data = await readData(SIGNUPS_FILE);
        
        const slot = data.slots.find(s => s.id === slotId);
        if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
        }
        
        if (startTime && validateTimestamp(startTime)) {
            slot.startTime = new Date(startTime).toISOString();
        }
        
        if (duration !== undefined) {
            slot.duration = sanitizeNumber(duration, 1, 240);
        }
        
        if (maxMembers !== undefined) {
            const newMax = sanitizeNumber(maxMembers, 1, 99);
            if (slot.signedUpMembers.length > newMax) {
                return res.status(400).json({ 
                    error: 'Cannot reduce max members below current signup count',
                    signedUpMembers: slot.signedUpMembers
                });
            }
            slot.maxMembers = newMax;
        }
        
        await writeData(SIGNUPS_FILE, data);
        
        const response = { 
            message: 'Slot updated successfully',
            slot
        };
        
        if (slot.signedUpMembers.length > 0) {
            response.signedUpMembers = slot.signedUpMembers;
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error modifying slot:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign up for a slot
app.post('/api/signupsheets/:sheetId/signup', async (req, res) => {
    try {
        const sheetId = sanitizeNumber(req.params.sheetId, 1, 999999);
        const { slotId, memberId } = req.body;
        
        if (!slotId || !memberId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const sanitizedSlotId = sanitizeNumber(slotId, 1, 999999);
        const sanitizedMemberId = sanitizeString(memberId, 8);
        
        if (sanitizedMemberId.length !== 8) {
            return res.status(400).json({ error: 'Invalid member ID format' });
        }
        
        const data = await readData(SIGNUPS_FILE);
        
        const sheet = data.signupSheets.find(s => s.id === sheetId);
        if (!sheet) {
            return res.status(404).json({ error: 'Signup sheet not found' });
        }
        
        const slot = data.slots.find(s => s.id === sanitizedSlotId && s.signupSheetId === sheetId);
        if (!slot) {
            return res.status(404).json({ error: 'Slot not found in this signup sheet' });
        }
        
        // Check time restrictions
        const now = new Date();
        const notBefore = new Date(sheet.notBefore);
        const notAfter = new Date(sheet.notAfter);
        
        if (now < notBefore) {
            return res.status(400).json({ error: 'Signup period has not started yet' });
        }
        
        if (now > notAfter) {
            return res.status(400).json({ error: 'Signup period has ended' });
        }
        
        // Check if member already signed up
        const alreadySignedUp = data.slots.some(s => 
            s.signupSheetId === sheetId && s.signedUpMembers.includes(sanitizedMemberId)
        );
        
        if (alreadySignedUp) {
            return res.status(400).json({ error: 'Member has already signed up for this assignment' });
        }
        
        // Check if slot is full
        if (slot.signedUpMembers.length >= slot.maxMembers) {
            return res.status(400).json({ error: 'This slot is full' });
        }
        
        // Add member to slot
        slot.signedUpMembers.push(sanitizedMemberId);
        
        // Record signup
        data.signups.push({
            signupSheetId: sheetId,
            slotId: sanitizedSlotId,
            memberId: sanitizedMemberId,
            signedUpAt: new Date().toISOString()
        });
        
        await writeData(SIGNUPS_FILE, data);
        
        res.status(201).json({ 
            message: 'Successfully signed up for slot',
            slot
        });
    } catch (error) {
        console.error('Error signing up:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a signup
app.delete('/api/signupsheets/:sheetId/signup/:memberId', async (req, res) => {
    try {
        const sheetId = sanitizeNumber(req.params.sheetId, 1, 999999);
        const memberId = sanitizeString(req.params.memberId, 8);
        
        const data = await readData(SIGNUPS_FILE);
        
        const slot = data.slots.find(s => 
            s.signupSheetId === sheetId && s.signedUpMembers.includes(memberId)
        );
        
        if (!slot) {
            return res.status(404).json({ error: 'Signup not found' });
        }
        
        slot.signedUpMembers = slot.signedUpMembers.filter(m => m !== memberId);
        
        data.signups = data.signups.filter(s => 
            !(s.signupSheetId === sheetId && s.memberId === memberId)
        );
        
        await writeData(SIGNUPS_FILE, data);
        
        res.json({ 
            message: 'Signup removed successfully',
            slot
        });
    } catch (error) {
        console.error('Error deleting signup:', error);
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