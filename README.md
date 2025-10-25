# Lab 3 Sign-up Sheet Management System

A RESTful API and web application for managing course sign-up sheets, student enrollment, and assignment grading.

## Project Structure

```
├── client/                 # Frontend files
│   ├── img/               # Image assets (gitignored)
│   ├── index.html         # Main HTML file
│   └── lab3.js            # Frontend JavaScript
├── server/                # Backend files
│   ├── data/              # Data storage files (gitignored)
│   ├── package.json       # Server dependencies
│   └── server.js          # Express server and API
└── README.md
```

## Features

### Backend API
- **Course Management**: Create, list, and delete courses; manage course members
- **Sign-up Sheet Management**: Create and manage sign-up sheets with time slots
- **Grading System**: Grade assignments and add comments
- **Input Sanitization**: All inputs validated for type, range, and security

### Frontend
- Create/modify/delete courses
- Add/remove course members
- Manage sign-up sheets and time slots
- Sign up for assignment slots
- Grade student submissions
- Asynchronous API communication

## Installation

### Local testing Development

1. Install Node.js (if you not already installed)

2. Clone the repository:
```bash
git clone git@github.com:Procheese02/western-webtech-classroom-test-lab3-lab3-template.git
cd backend
```

3. Install server dependencies:
```bash
npm install
```

4. Start the server:
```bash
node server.js
```

5. run the application locally at `http://localhost:3000`

## API Endpoints

### Course Management
- `POST /api/courses` - Create a course
- `GET /api/courses` - List all courses
- `DELETE /api/courses/:termcode/:section` - Delete a course
- `POST /api/courses/:termcode/:section/members` - Add members
- `GET /api/courses/:termcode/:section/members` - List members
- `DELETE /api/courses/:termcode/:section/members` - Delete members

### Sign-up Sheets
- `POST /api/signups` - Create sign-up sheet
- `DELETE /api/signups/:id` - Delete sign-up sheet
- `GET /api/signups/:termcode/:section` - List sign-up sheets
- `POST /api/signups/:id/slots` - Add slots
- `GET /api/signups/:id/slots` - List slots
- `PUT /api/slots/:id` - Modify slot
- `POST /api/signups/:id/signup` - Sign up for slot
- `DELETE /api/signups/:id/signup/:memberid` - Remove sign-up

### Grading
- `GET /api/slots/:id/members` - List members for slot
- `POST /api/grades` - Enter/modify grade
