document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        
        // Update active button
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active section
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
    });
});

// Message display function
function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('message-area');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    messageDiv.appendChild(document.createTextNode(message));
    
    messageArea.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('slide-out');
        setTimeout(() => messageDiv.remove(), 300);
    }, 5000);
}

// Helper functions
async function apiRequest(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
}

// Sanitize display text - prevents HTML/JS injection
function sanitizeDisplay(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.textContent;
}

// Create element with sanitized text
function createTextElement(tag, text) {
    const element = document.createElement(tag);
    if (text) {
        element.appendChild(document.createTextNode(text));
    }
    return element;
}

// ============ COURSE MANAGEMENT ============

// Create course
document.getElementById('create-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const termCode = document.getElementById('course-term-code').value;
    const courseName = document.getElementById('course-name').value;
    const section = document.getElementById('course-section').value;
    
    try {
        const data = await apiRequest('/api/courses', 'POST', {
            termCode: parseInt(termCode),
            courseName,
            section: parseInt(section)
        });
        
        showMessage(data.message, 'success');
        e.target.reset();
        document.getElementById('course-section').value = '1';
        refreshCourses();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// Refresh courses list
async function refreshCourses() {
    try {
        const courses = await apiRequest('/api/courses');
        const listDiv = document.getElementById('courses-list');
        listDiv.innerHTML = '';
        
        if (courses.length === 0) {
            const emptyDiv = createTextElement('div', 'No courses found.');
            emptyDiv.className = 'empty-state';
            listDiv.appendChild(emptyDiv);
            return;
        }
        
        courses.forEach(course => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            
            const row1 = document.createElement('div');
            row1.className = 'data-item-row';
            const strong1 = createTextElement('strong', 'Term Code: ');
            row1.appendChild(strong1);
            row1.appendChild(document.createTextNode(course.termCode));
            
            const row2 = document.createElement('div');
            row2.className = 'data-item-row';
            const strong2 = createTextElement('strong', 'Course Name: ');
            row2.appendChild(strong2);
            row2.appendChild(document.createTextNode(course.courseName));
            
            const row3 = document.createElement('div');
            row3.className = 'data-item-row';
            const strong3 = createTextElement('strong', 'Section: ');
            row3.appendChild(strong3);
            row3.appendChild(document.createTextNode(course.section));
            
            const deleteBtn = createTextElement('button', 'Delete');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.onclick = () => deleteCourse(course.termCode, course.section);
            
            itemDiv.appendChild(row1);
            itemDiv.appendChild(row2);
            itemDiv.appendChild(row3);
            itemDiv.appendChild(deleteBtn);
            
            listDiv.appendChild(itemDiv);
        });
    } catch (error) {
        showMessage('Error loading courses: ' + error.message, 'error');
    }
}

// Delete course
async function deleteCourse(termCode, section) {
    if (!confirm(`Are you sure you want to delete this course (Term: ${termCode}, Section: ${section})?`)) {
        return;
    }
    
    try {
        const data = await apiRequest(`/api/courses/${termCode}/${section}`, 'DELETE');
        showMessage(data.message, 'success');
        refreshCourses();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

document.getElementById('refresh-courses').addEventListener('click', refreshCourses);

// ============ MEMBER MANAGEMENT ============

// Add member
document.getElementById('add-members-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const termCode = document.getElementById('member-term-code').value;
    const section = document.getElementById('member-section').value;
    const memberId = document.getElementById('member-id').value;
    const firstName = document.getElementById('member-first-name').value;
    const lastName = document.getElementById('member-last-name').value;
    const role = document.getElementById('member-role').value;
    
    try {
        const data = await apiRequest(`/api/courses/${termCode}/${section}/members`, 'POST', {
            members: [{
                memberId,
                firstName,
                lastName,
                role
            }]
        });
        
        let message = `${data.addedCount} member(s) added`;
        if (data.ignoredIds.length > 0) {
            message += `. Ignored: ${data.ignoredIds.join(', ')}`;
        }
        showMessage(message, 'success');
        e.target.reset();
        document.getElementById('member-section').value = '1';
        document.getElementById('member-role').value = 'student';
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// View members
document.getElementById('view-members').addEventListener('click', async () => {
    const termCode = document.getElementById('view-member-term').value;
    const section = document.getElementById('view-member-section').value;
    const role = document.getElementById('view-member-role').value;
    
    if (!termCode) {
        showMessage('Please enter a term code', 'error');
        return;
    }
    
    try {
        let url = `/api/courses/${termCode}/${section}/members`;
        if (role) {
            url += `?role=${encodeURIComponent(role)}`;
        }
        
        const members = await apiRequest(url);
        const listDiv = document.getElementById('members-list');
        listDiv.innerHTML = '';
        
        if (members.length === 0) {
            const emptyDiv = createTextElement('div', 'No members found.');
            emptyDiv.className = 'empty-state';
            listDiv.appendChild(emptyDiv);
            return;
        }
        
        members.forEach(member => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            
            const row1 = document.createElement('div');
            row1.className = 'data-item-row';
            const strong1 = createTextElement('strong', 'Member ID: ');
            row1.appendChild(strong1);
            row1.appendChild(document.createTextNode(member.memberId));
            
            const row2 = document.createElement('div');
            row2.className = 'data-item-row';
            const strong2 = createTextElement('strong', 'Name: ');
            row2.appendChild(strong2);
            // Support UTF-8 names
            row2.appendChild(document.createTextNode(`${member.firstName} ${member.lastName}`));
            
            const row3 = document.createElement('div');
            row3.className = 'data-item-row';
            const strong3 = createTextElement('strong', 'Role: ');
            row3.appendChild(strong3);
            row3.appendChild(document.createTextNode(member.role));
            
            const deleteBtn = createTextElement('button', 'Delete');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.onclick = () => deleteMember(termCode, section, member.memberId);
            
            itemDiv.appendChild(row1);
            itemDiv.appendChild(row2);
            itemDiv.appendChild(row3);
            itemDiv.appendChild(deleteBtn);
            
            listDiv.appendChild(itemDiv);
        });
    } catch (error) {
        showMessage('Error loading members: ' + error.message, 'error');
    }
});

// Delete member
async function deleteMember(termCode, section, memberId) {
    if (!confirm(`Delete member ${memberId}?`)) {
        return;
    }
    
    try {
        const data = await apiRequest(`/api/courses/${termCode}/${section}/members`, 'DELETE', {
            memberIds: [memberId]
        });
        showMessage(data.message, 'success');
        document.getElementById('view-members').click();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

// ============ SIGNUP SHEET MANAGEMENT ============

// Create signup sheet
document.getElementById('create-signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const termCode = document.getElementById('signup-term-code').value;
    const section = document.getElementById('signup-section').value;
    const assignmentName = document.getElementById('assignment-name').value;
    const notBefore = document.getElementById('not-before').value;
    const notAfter = document.getElementById('not-after').value;
    
    try {
        const data = await apiRequest('/api/signupsheets', 'POST', {
            termCode: parseInt(termCode),
            section: parseInt(section),
            assignmentName,
            notBefore: new Date(notBefore).toISOString(),
            notAfter: new Date(notAfter).toISOString()
        });
        
        showMessage(`${data.message}. Sheet ID: ${data.signupSheet.id}`, 'success');
        e.target.reset();
        document.getElementById('signup-section').value = '1';
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// View signup sheets
document.getElementById('view-signups').addEventListener('click', async () => {
    const termCode = document.getElementById('view-signup-term').value;
    const section = document.getElementById('view-signup-section').value;
    
    if (!termCode) {
        showMessage('Please enter a term code', 'error');
        return;
    }
    
    try {
        const sheets = await apiRequest(`/api/courses/${termCode}/${section}/signupsheets`);
        const listDiv = document.getElementById('signups-list');
        listDiv.innerHTML = '';
        
        if (sheets.length === 0) {
            const emptyDiv = createTextElement('div', 'No signup sheets found.');
            emptyDiv.className = 'empty-state';
            listDiv.appendChild(emptyDiv);
            return;
        }
        
        sheets.forEach(sheet => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            
            const row1 = document.createElement('div');
            row1.className = 'data-item-row';
            const strong1 = createTextElement('strong', 'Sheet ID: ');
            row1.appendChild(strong1);
            row1.appendChild(document.createTextNode(sheet.id));
            
            const row2 = document.createElement('div');
            row2.className = 'data-item-row';
            const strong2 = createTextElement('strong', 'Assignment: ');
            row2.appendChild(strong2);
            row2.appendChild(document.createTextNode(sheet.assignmentName));
            
            const row3 = document.createElement('div');
            row3.className = 'data-item-row';
            const strong3 = createTextElement('strong', 'Available: ');
            row3.appendChild(strong3);
            row3.appendChild(document.createTextNode(
                `${new Date(sheet.notBefore).toLocaleString()} - ${new Date(sheet.notAfter).toLocaleString()}`
            ));
            
            const deleteBtn = createTextElement('button', 'Delete');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.onclick = () => deleteSignupSheet(sheet.id);
            
            itemDiv.appendChild(row1);
            itemDiv.appendChild(row2);
            itemDiv.appendChild(row3);
            itemDiv.appendChild(deleteBtn);
            
            listDiv.appendChild(itemDiv);
        });
    } catch (error) {
        showMessage('Error loading signup sheets: ' + error.message, 'error');
    }
});

// Delete signup sheet
async function deleteSignupSheet(id) {
    if (!confirm(`Delete signup sheet ${id}?`)) {
        return;
    }
    
    try {
        const data = await apiRequest(`/api/signupsheets/${id}`, 'DELETE');
        showMessage(data.message, 'success');
        document.getElementById('view-signups').click();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

// ============ SLOT MANAGEMENT ============

// Add slots
document.getElementById('add-slots-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const signupId = document.getElementById('slot-signup-id').value;
    const start = document.getElementById('slot-start').value;
    const duration = document.getElementById('slot-duration').value;
    const numSlots = document.getElementById('num-slots').value;
    const maxMembers = document.getElementById('max-members').value;
    
    try {
        const data = await apiRequest(`/api/signupsheets/${signupId}/slots`, 'POST', {
            start: new Date(start).toISOString(),
            slotDuration: parseInt(duration),
            numSlots: parseInt(numSlots),
            maxMembers: parseInt(maxMembers)
        });
        
        showMessage(`${data.message}. Created ${data.slots.length} slots.`, 'success');
        e.target.reset();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// Sign up for slot
document.getElementById('signup-slot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const sheetId = document.getElementById('signup-sheet-id').value;
    const slotId = document.getElementById('signup-slot-id').value;
    const memberId = document.getElementById('signup-member-id').value;
    
    try {
        const data = await apiRequest(`/api/signupsheets/${sheetId}/signup`, 'POST', {
            slotId: parseInt(slotId),
            memberId
        });
        
        showMessage(data.message, 'success');
        e.target.reset();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// View slots
document.getElementById('view-slots').addEventListener('click', async () => {
    const signupId = document.getElementById('view-slots-signup-id').value;
    
    if (!signupId) {
        showMessage('Please enter a signup sheet ID', 'error');
        return;
    }
    
    try {
        const slots = await apiRequest(`/api/signupsheets/${signupId}/slots`);
        const listDiv = document.getElementById('slots-list');
        listDiv.innerHTML = '';
        
        if (slots.length === 0) {
            const emptyDiv = createTextElement('div', 'No slots found.');
            emptyDiv.className = 'empty-state';
            listDiv.appendChild(emptyDiv);
            return;
        }
        
        slots.forEach(slot => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            
            const row1 = document.createElement('div');
            row1.className = 'data-item-row';
            const strong1 = createTextElement('strong', 'Slot ID: ');
            row1.appendChild(strong1);
            row1.appendChild(document.createTextNode(slot.id));
            
            const row2 = document.createElement('div');
            row2.className = 'data-item-row';
            const strong2 = createTextElement('strong', 'Time: ');
            row2.appendChild(strong2);
            row2.appendChild(document.createTextNode(new Date(slot.startTime).toLocaleString()));
            
            const row3 = document.createElement('div');
            row3.className = 'data-item-row';
            const strong3 = createTextElement('strong', 'Duration: ');
            row3.appendChild(strong3);
            row3.appendChild(document.createTextNode(`${slot.duration} minutes`));
            
            const row4 = document.createElement('div');
            row4.className = 'data-item-row';
            const strong4 = createTextElement('strong', 'Capacity: ');
            row4.appendChild(strong4);
            row4.appendChild(document.createTextNode(
                `${slot.signedUpMembers.length}/${slot.maxMembers}`
            ));
            
            if (slot.signedUpMembers.length > 0) {
                const membersDiv = document.createElement('div');
                membersDiv.className = 'slot-info';
                const membersLabel = createTextElement('strong', 'Signed up: ');
                membersDiv.appendChild(membersLabel);
                
                slot.signedUpMembers.forEach(memberId => {
                    const badge = createTextElement('span', memberId);
                    badge.className = 'member-badge';
                    membersDiv.appendChild(badge);
                });
                
                itemDiv.appendChild(membersDiv);
            }
            
            const deleteBtn = createTextElement('button', 'Remove Sign-up');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.onclick = () => {
                const memberId = prompt('Enter member ID to remove:');
                if (memberId) {
                    deleteSignup(signupId, memberId);
                }
            };
            
            itemDiv.appendChild(row1);
            itemDiv.appendChild(row2);
            itemDiv.appendChild(row3);
            itemDiv.appendChild(row4);
            itemDiv.appendChild(deleteBtn);
            
            listDiv.appendChild(itemDiv);
        });
    } catch (error) {
        showMessage('Error loading slots: ' + error.message, 'error');
    }
});

// Delete signup
async function deleteSignup(sheetId, memberId) {
    try {
        const data = await apiRequest(`/api/signupsheets/${sheetId}/signup/${memberId}`, 'DELETE');
        showMessage(data.message, 'success');
        document.getElementById('view-slots').click();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

// ============ GRADING MANAGEMENT ============

// Enter grade
document.getElementById('enter-grade-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const memberId = document.getElementById('grade-member-id').value;
    const signupId = document.getElementById('grade-signup-id').value;
    const grade = document.getElementById('grade-value').value;
    const comment = document.getElementById('grade-comment').value;
    
    try {
        const data = await apiRequest('/api/grades', 'POST', {
            memberId,
            signupSheetId: parseInt(signupId),
            grade: parseInt(grade),
            comment
        });
        
        let message = data.message;
        if (data.originalGrade !== undefined) {
            message += ` (Previous grade: ${data.originalGrade})`;
        }
        showMessage(message, 'success');
        e.target.reset();
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
});

// View slot members
document.getElementById('view-slot-members').addEventListener('click', async () => {
    const slotId = document.getElementById('view-slot-members-id').value;
    
    if (!slotId) {
        showMessage('Please enter a slot ID', 'error');
        return;
    }
    
    try {
        const data = await apiRequest(`/api/slots/${slotId}/members`);
        const listDiv = document.getElementById('slot-members-list');
        listDiv.innerHTML = '';
        
        if (data.members.length === 0) {
            const emptyDiv = createTextElement('div', 'No members signed up for this slot.');
            emptyDiv.className = 'empty-state';
            listDiv.appendChild(emptyDiv);
            return;
        }
        
        // Display slot info
        const slotInfoDiv = document.createElement('div');
        slotInfoDiv.className = 'slot-info';
        slotInfoDiv.style.marginBottom = '20px';
        
        const slotTitle = createTextElement('strong', `Slot ${data.slot.id} - `);
        slotInfoDiv.appendChild(slotTitle);
        slotInfoDiv.appendChild(document.createTextNode(
            `${new Date(data.slot.startTime).toLocaleString()} (${data.slot.duration} min)`
        ));
        
        listDiv.appendChild(slotInfoDiv);
        
        // Display members
        for (const member of data.members) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'data-item';
            
            const row1 = document.createElement('div');
            row1.className = 'data-item-row';
            const strong1 = createTextElement('strong', 'Member ID: ');
            row1.appendChild(strong1);
            row1.appendChild(document.createTextNode(member.memberId));
            
            const row2 = document.createElement('div');
            row2.className = 'data-item-row';
            const strong2 = createTextElement('strong', 'Name: ');
            row2.appendChild(strong2);
            row2.appendChild(document.createTextNode(`${member.firstName} ${member.lastName}`));
            
            const row3 = document.createElement('div');
            row3.className = 'data-item-row';
            const strong3 = createTextElement('strong', 'Role: ');
            row3.appendChild(strong3);
            row3.appendChild(document.createTextNode(member.role));
            
            itemDiv.appendChild(row1);
            itemDiv.appendChild(row2);
            itemDiv.appendChild(row3);
            
            // Try to fetch grade for this member
            try {
                const grade = await apiRequest(`/api/grades/${member.memberId}/${data.slot.signupSheetId}`);
                if (grade) {
                    const gradeDiv = document.createElement('div');
                    gradeDiv.className = 'grade-info';
                    
                    const gradeLabel = createTextElement('strong', 'Grade: ');
                    gradeDiv.appendChild(gradeLabel);
                    gradeDiv.appendChild(document.createTextNode(grade.grade));
                    gradeDiv.appendChild(document.createElement('br'));
                    
                    if (grade.comment) {
                        const commentLabel = createTextElement('strong', 'Comment: ');
                        gradeDiv.appendChild(commentLabel);
                        gradeDiv.appendChild(document.createTextNode(grade.comment));
                    }
                    
                    itemDiv.appendChild(gradeDiv);
                }
            } catch (err) {
                // No grade found, that's okay
            }
            
            listDiv.appendChild(itemDiv);
        }
    } catch (error) {
        showMessage('Error loading slot members: ' + error.message, 'error');
    }
});

// Initialize - load courses on page load
refreshCourses();