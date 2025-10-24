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

// Initialize - load courses on page load
refreshCourses();