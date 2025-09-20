const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session'); // Import express-session
const nodemailer = require('nodemailer'); // ⭐ NEW: Import Nodemailer ⭐

const app = express();
const PORT = 5000;

// Log the current directory where hms.js is running from
console.log(`__dirname (current script directory): ${__dirname}`);

// --- Middleware Setup ---
// Enable CORS for cross-origin requests (important for frontend development)
app.use(cors({
    origin: `http://localhost:${PORT}`, // Allow requests from your frontend served at this address
    credentials: true // Crucial for allowing cookies (session ID) to be sent and received
}));

// Parse JSON request bodies
app.use(bodyParser.json());
app.use(express.json());

// Serve static files from the 'hms' subdirectory relative to hms.js
const staticFilesDir = path.join(__dirname, 'hms');
app.use(express.static(staticFilesDir));
console.log(`Serving static HTML/CSS/JS files from: ${staticFilesDir}`);

// Setup express-session middleware
app.use(session({
    secret: 'your_super_secret_key_for_session_hms_app', // ⚠️ CRITICAL: Replace with a long, random, and unguessable string!
                                                         // This is used to sign the session ID cookie.
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored (e.g., after login)
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // Session lasts 24 hours (in milliseconds)
        secure: false, // Set to `true` if your site is served over HTTPS (essential for production)
                       // Keep `false` for local HTTP development (e.g., http://localhost:5000)
        httpOnly: true // Prevents client-side JavaScript from accessing the session cookie (security best practice)
    }
}));

// ⭐ Nodemailer Transporter Setup ⭐
// IMPORTANT: These are your provided credentials.
const SMTP_CONFIG = {
    host: 'smtp.gmail.com', // Gmail's SMTP host
    port: 465, // Gmail's recommended SSL port
    secure: true, // Use 'true' for port 465 (SSL)
    auth: {
        user: 'hospitalmanagementsys110@gmail.com', // Your provided email
        pass: 'htuz pccm ygia nnzp' // Your provided App Password
    },
    tls: {
        // Do not fail on invalid certs, useful for local development with self-signed certs
        // In production, you should remove this or set to true if you have proper certificates
        rejectUnauthorized: false
    }
};

const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Function to send email
async function sendEmail(to, subject, htmlContent) {
    try {
        const mailOptions = {
            from: `"HMS Announcements" <${SMTP_CONFIG.auth.user}>`, // Sender address
            to: to, // List of receivers (comma separated string)
            subject: subject, // Subject line
            html: htmlContent // HTML body
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent: %s', info.messageId);
        // Note: getTestMessageUrl is for ethereal.email, not for real SMTP services like Gmail
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { success: false, error: error.message };
    }
}
// ⭐ END Nodemailer Transporter Setup ⭐


// --- Database Initialization ---
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to SQLite database:', err.message);
    } else {
        console.log('✅ Connected to the SQLite database.');
        // Create users table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'patient'
        )`, (createErr) => {
            if (createErr) {
                console.error('Error creating users table:', createErr.message);
            } else {
                console.log('Users table checked/created successfully.');

                // Create doctors table if it doesn't exist
                db.run(`CREATE TABLE IF NOT EXISTS doctors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    specialization TEXT,
                    phone TEXT,
                    address TEXT,
                    salary REAL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`, (createDoctorsErr) => {
                    if (createDoctorsErr) {
                        console.error('Error creating doctors table:', createDoctorsErr.message);
                    } else {
                        console.log('Doctors table checked/created successfully.');

                        // Create appointments table if it doesn't exist
                        db.run(`CREATE TABLE IF NOT EXISTS appointments (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            patient_id INTEGER NOT NULL,
                            doctor_id INTEGER NOT NULL,
                            appointment_date TEXT NOT NULL,
                            appointment_time TEXT NOT NULL,
                            reason TEXT,
                            status TEXT DEFAULT 'Pending',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
                        )`, (createAppointmentsErr) => {
                            if (createAppointmentsErr) {
                                console.error('Error creating appointments table:', createAppointmentsErr.message);
                            } else {
                                console.log('Appointments table checked/created successfully.');

                                // Create medical_records table
                                db.run(`CREATE TABLE IF NOT EXISTS medical_records (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    patient_id INTEGER NOT NULL,
                                    doctor_id INTEGER NOT NULL,
                                    appointment_id INTEGER, -- Optional: Link to a specific appointment
                                    diagnosis TEXT NOT NULL,
                                    notes TEXT,
                                    record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
                                    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
                                    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
                                )`, (createMedicalRecordsErr) => {
                                    if (createMedicalRecordsErr) {
                                        console.error('Error creating medical_records table:', createMedicalRecordsErr.message);
                                    } else {
                                        console.log('Medical records table checked/created successfully.');

                                        // Create prescriptions table
                                        db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            patient_id INTEGER NOT NULL,
                                            doctor_id INTEGER NOT NULL,
                                            medication_name TEXT NOT NULL,
                                            dosage TEXT NOT NULL,
                                            instructions TEXT,
                                            start_date TEXT NOT NULL,
                                            end_date TEXT,
                                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                            FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
                                            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
                                        )`, (createPrescriptionsErr) => {
                                            if (createPrescriptionsErr) {
                                                console.error('Error creating prescriptions table:', createPrescriptionsErr.message);
                                            } else {
                                                console.log('Prescriptions table checked/created successfully.');

                                                // Create doctor_schedules table
                                                db.run(`CREATE TABLE IF NOT EXISTS doctor_schedules (
                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                    doctor_id INTEGER NOT NULL,
                                                    schedule_date TEXT NOT NULL,
                                                    start_time TEXT NOT NULL,
                                                    end_time TEXT NOT NULL,
                                                    status TEXT DEFAULT 'Available', -- e.g., 'Available', 'Unavailable', 'On Leave'
                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
                                                )`, (createSchedulesErr) => {
                                                    if (createSchedulesErr) {
                                                        console.error('Error creating doctor_schedules table:', createSchedulesErr.message);
                                                    } else {
                                                        console.log('Doctor schedules table checked/created successfully.');

                                                        // ⭐ NEW: Create emergency_cases table ⭐
                                                        db.run(`CREATE TABLE IF NOT EXISTS emergency_cases (
                                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                            patient_id INTEGER,
                                                            patient_name TEXT,
                                                            contact_info TEXT,
                                                            emergency_type TEXT NOT NULL,
                                                            description TEXT,
                                                            severity TEXT NOT NULL, -- 'Critical', 'Urgent', 'Stable'
                                                            time_of_incident DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                            assigned_doctor_id INTEGER,
                                                            assigned_nurse_ids TEXT, -- Stored as JSON string of array of IDs
                                                            assigned_bed TEXT,
                                                            current_status TEXT DEFAULT 'Triage', -- 'Triage', 'In Treatment', 'Stabilized', 'Awaiting Transfer', 'Discharged', 'Resolved', 'Deceased'
                                                            notes TEXT,
                                                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                            FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE SET NULL,
                                                            FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
                                                        )`, (createEmergencyErr) => {
                                                            if (createEmergencyErr) {
                                                                console.error('Error creating emergency_cases table:', createEmergencyErr.message);
                                                            } else {
                                                                console.log('Emergency cases table checked/created successfully.');

                                                                // ⭐ NEW: Create beds table ⭐
                                                                db.run(`CREATE TABLE IF NOT EXISTS beds (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    bed_number TEXT UNIQUE NOT NULL,
                                                                    room_number TEXT,
                                                                    ward TEXT,
                                                                    status TEXT DEFAULT 'Available', -- 'Available', 'Occupied', 'Under Maintenance', 'Cleaning'
                                                                    current_patient_id INTEGER,
                                                                    last_occupied_by_patient_id INTEGER,
                                                                    last_occupied_at DATETIME,
                                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY (current_patient_id) REFERENCES users(id) ON DELETE SET NULL,
                                                                    FOREIGN KEY (last_occupied_by_patient_id) REFERENCES users(id) ON DELETE SET NULL
                                                                )`, (createBedsErr) => {
                                                                    if (createBedsErr) {
                                                                        console.error('Error creating beds table:', createBedsErr.message);
                                                                    } else {
                                                                        console.log('Beds table checked/created successfully.');
                                                                        // Insert some default beds if none exist
                                                                        db.get(`SELECT COUNT(*) AS count FROM beds`, (err, row) => {
                                                                            if (err) {
                                                                                console.error('Error checking bed count:', err.message);
                                                                                return;
                                                                            }
                                                                            if (row.count === 0) {
                                                                                const defaultBeds = [
                                                                                    { bed_number: 'ER-1', room_number: 'ER-Room-A', ward: 'Emergency', status: 'Available' },
                                                                                    { bed_number: 'ER-2', room_number: 'ER-Room-A', ward: 'Emergency', status: 'Available' },
                                                                                    { bed_number: 'ICU-1', room_number: 'ICU-Room-1', ward: 'ICU', status: 'Available' },
                                                                                    { bed_number: 'WARD-A-1', room_number: 'Ward-A-Room-1', ward: 'General Ward A', status: 'Available' },
                                                                                    { bed_number: 'WARD-A-2', room_number: 'Ward-A-Room-1', ward: 'General Ward A', status: 'Occupied' }
                                                                                ];
                                                                                const insertStmt = db.prepare(`INSERT INTO beds (bed_number, room_number, ward, status) VALUES (?, ?, ?, ?)`);
                                                                                defaultBeds.forEach(bed => {
                                                                                    insertStmt.run(bed.bed_number, bed.room_number, bed.ward, bed.status, (insertErr) => {
                                                                                        if (insertErr) {
                                                                                            console.error(`Error inserting default bed ${bed.bed_number}:`, insertErr.message);
                                                                                        } else {
                                                                                            console.log(`Default bed ${bed.bed_number} inserted.`);
                                                                                        }
                                                                                    });
                                                                                });
                                                                                insertStmt.finalize();
                                                                            }
                                                                        });
                                                                    }
                                                                });

                                                                // ⭐ NEW: Create lab_reports table ⭐
                                                                db.run(`CREATE TABLE IF NOT EXISTS lab_reports (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    patient_id INTEGER NOT NULL,
                                                                    patient_name TEXT NOT NULL,
                                                                    test_type TEXT NOT NULL,
                                                                    test_date TEXT NOT NULL,
                                                                    results TEXT NOT NULL,
                                                                    notes TEXT,
                                                                    status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed', 'Awaiting Review'
                                                                    lab_technician_id INTEGER NOT NULL,
                                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                    FOREIGN KEY (lab_technician_id) REFERENCES users(id) ON DELETE CASCADE
                                                                )`, (createLabReportsErr) => {
                                                                    if (createLabReportsErr) {
                                                                        console.error('Error creating lab_reports table:', createLabReportsErr.message);
                                                                    } else {
                                                                        console.log('Lab reports table checked/created successfully.');
                                                                    }
                                                                });

                                                                // ⭐ NEW: Create inventory table ⭐
                                                                db.run(`CREATE TABLE IF NOT EXISTS inventory (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    item_name TEXT NOT NULL UNIQUE,
                                                                    category TEXT,
                                                                    quantity INTEGER NOT NULL,
                                                                    unit TEXT,
                                                                    price REAL,
                                                                    expiry_date TEXT,
                                                                    supplier TEXT,
                                                                    last_updated_by INTEGER,
                                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL
                                                                )`, (createInventoryErr) => {
                                                                    if (createInventoryErr) {
                                                                        console.error('Error creating inventory table:', createInventoryErr.message);
                                                                    } else {
                                                                        console.log('Inventory table checked/created successfully.');
                                                                    }
                                                                });

                                                                // ⭐ NEW: Create announcements table ⭐
                                                                db.run(`CREATE TABLE IF NOT EXISTS announcements (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    title TEXT NOT NULL,
                                                                    message TEXT NOT NULL,
                                                                    target_role TEXT NOT NULL, -- 'all', 'patient', 'doctor', 'nurse', etc.
                                                                    sent_by_user_id INTEGER NOT NULL,
                                                                    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                                                                )`, (createAnnouncementsErr) => {
                                                                    if (createAnnouncementsErr) {
                                                                        console.error('Error creating announcements table:', createAnnouncementsErr.message);
                                                                    } else {
                                                                        console.log('Announcements table checked/created successfully.');
                                                                    }
                                                                });

                                                                // ⭐ NEW: Create bills table ⭐
                                                                db.run(`CREATE TABLE IF NOT EXISTS bills (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    patient_id INTEGER NOT NULL,
                                                                    appointment_id INTEGER,
                                                                    appointment_charge REAL NOT NULL DEFAULT 500.00,
                                                                    treatment_details TEXT,
                                                                    medicines_used_json TEXT, -- JSON string of [{medicine_id, name, quantity, unit_price, total_price_for_item}]
                                                                    total_medicine_charge REAL NOT NULL DEFAULT 0.00,
                                                                    total_bill REAL NOT NULL,
                                                                    billed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                    billed_by_user_id INTEGER NOT NULL,
                                                                    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
                                                                    FOREIGN KEY (billed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                                                                )`, (createBillsErr) => {
                                                                    if (createBillsErr) {
                                                                        console.error('Error creating bills table:', createBillsErr.message);
                                                                    } else {
                                                                        console.log('Bills table checked/created successfully.');
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });

                        // Logic to automatically create default users (admin, nurse, doctor, lab_technician, pharmacist, receptionist) if they don't exist
                        const defaultUsers = [
                            { email: 'admin@example.com', name: 'Admin User', password: 'adminpassword', role: 'admin' },
                            { email: 'nurse@example.com', name: 'Nurse Jane', password: 'nursepassword', role: 'nurse' },
                            { email: 'doctor@example.com', name: 'Dr. John Doe', password: 'doctorpassword', role: 'doctor', specialization: 'General Medicine', phone: '0300-1234567', address: '123 Hospital St', salary: 80000.00 },
                            { email: 'labtech@example.com', name: 'Lab Tech Mike', password: 'labtechpassword', role: 'lab_technician' },
                            { email: 'pharmacist@example.com', name: 'Pharmacist Sarah', password: 'pharmacistpassword', role: 'pharmacist' },
                            { email: 'receptionist@example.com', name: 'Receptionist Emily', password: 'receptionistpassword', role: 'receptionist' }, // ⭐ NEW DEFAULT RECEPTIONIST ⭐
                            { email: 'patient@example.com', name: 'Patient Alice', password: 'patientpassword', role: 'patient' }
                        ];

                        defaultUsers.forEach(defaultUser => {
                            db.get(`SELECT * FROM users WHERE email = ? AND role = ?`, [defaultUser.email, defaultUser.role], (err, row) => {
                                if (err) {
                                    console.error(`Error checking for existing ${defaultUser.role} user:`, err.message);
                                    return;
                                }
                                if (!row) {
                                    bcrypt.hash(defaultUser.password, 10, (hashErr, hashedPassword) => {
                                        if (hashErr) {
                                            console.error(`Error hashing default ${defaultUser.role} password:`, hashErr.message);
                                            return;
                                        }
                                        db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                                            [defaultUser.name, defaultUser.email, hashedPassword, defaultUser.role],
                                            function(insertErr) {
                                                if (insertErr) {
                                                    console.error(`Error inserting default ${defaultUser.role} user:`, insertErr.message);
                                                } else {
                                                    console.log(`Default ${defaultUser.role} user (${defaultUser.email}) created.`);
                                                    if (defaultUser.role === 'doctor') {
                                                        const userId = this.lastID;
                                                        db.run(`INSERT INTO doctors (user_id, name, email, specialization, phone, address, salary) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                                            [userId, defaultUser.name, defaultUser.email, defaultUser.specialization, defaultUser.phone, defaultUser.address, defaultUser.salary],
                                                            (insertDoctorErr) => {
                                                                if (insertDoctorErr) {
                                                                    console.error('Error inserting default doctor into doctors table:', insertDoctorErr.message);
                                                                } else {
                                                                    console.log('Default doctor user created in both users and doctors tables.');
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            }
                                        );
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
    }
});

// --- Authentication & Authorization Middleware ---
// Checks if a user is currently logged in (has an active session)
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next(); // User is authenticated, proceed
    } else {
        // For API routes, send a 401. For HTML pages, redirect to login.
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ error: '🚫 Unauthorized: Please log in to access this resource.' });
        } else {
            res.redirect('/front.html'); // Redirect to login page for unauthenticated access to HTML pages
        }
    }
};

// Checks if the logged-in user has a specific role
const authorizeRole = (requiredRole) => (req, res, next) => {
    if (req.session.role && req.session.role === requiredRole) {
        next(); // User has the required role, proceed
    } else {
        res.status(403).json({ error: `⛔ Forbidden: You do not have the necessary permissions. (${requiredRole} role required)` });
    }
};

// Checks if the logged-in user has one of the specified roles
const authorizeRoles = (requiredRoles) => (req, res, next) => {
    if (req.session.role && requiredRoles.includes(req.session.role)) {
        next(); // User has one of the required roles, proceed
    } else {
        res.status(403).json({ error: `⛔ Forbidden: You do not have the necessary permissions. (Required roles: ${requiredRoles.join(', ')})` });
    }
};

// --- Authentication Routes (No `isAuthenticated` middleware here as these are for login/signup/logout) ---

// Route for new user registration
app.post('/signup', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields (name, email, password, role) are required for signup.' });
    }

    // Hash the password before storing it
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password during signup:', err.message);
            return res.status(500).json({ error: 'Server error during signup. Please try again.' });
        }

        // ⭐ UPDATED allowedRoles for signup ⭐
        const allowedRoles = ['patient', 'doctor', 'nurse', 'admin', 'receptionist', 'lab_technician', 'pharmacist'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified.' });
        }

        // Insert new user into the database
        db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
            [name, email, hash, role], function(err) {
            if (err) {
                console.error('Database error during signup:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already registered. Please use a different email or log in.' });
                }
                return res.status(500).json({ error: 'Failed to register user. Internal server error.' });
            }
            console.log(`New user registered: ${email} with ID: ${this.lastID}`);
            res.status(201).json({ message: 'User registered successfully! You can now log in.', userId: this.lastID });
        });
    });
});

// Route for user login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required for login.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            console.error('Database error during login:', err.message);
            return res.status(500).json({ error: 'Server error during login. Please try again.' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err.message);
                return res.status(500).json({ error: 'Server error during login.' });
            }
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }

            // Authentication successful: Store user info in the session
            req.session.userId = user.id;
            req.session.role = user.role;
            req.session.userName = user.name;
            req.session.userEmail = user.email; // Store email in session for easy access

            console.log(`User logged in: ${user.email} (Role: ${user.role})`);

            // ⭐ Determine redirect URL based on role ⭐
            let redirectUrl = '/front.html'; // Default redirect
            switch (user.role) {
                case 'admin':
                    redirectUrl = '/admin-dashboard.html';
                    break;
                case 'patient':
                    redirectUrl = '/patient-dashboard.html';
                    break;
                case 'doctor':
                    redirectUrl = '/doctor-dashboard.html';
                    break;
                case 'nurse':
                    redirectUrl = '/nurse-dashboard.html';
                    break;
                case 'lab_technician':
                    redirectUrl = '/lab-dashboard.html';
                    break;
                case 'pharmacist':
                    redirectUrl = '/pharmacist-dashboard.html';
                    break;
                case 'receptionist': // ⭐ NEW REDIRECTION FOR RECEPTIONIST ⭐
                    redirectUrl = '/receptionist-dashboard.html'; // Create this page later
                    break;
                default:
                    redirectUrl = '/front.html'; // Fallback
            }

            res.status(200).json({
                message: 'Login successful!',
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                redirectUrl: redirectUrl // Send redirect URL to frontend
            });
        });
    });
});

// Route for user logout
app.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(err => { // Destroy the server-side session
        if (err) {
            console.error('Error destroying session:', err.message);
            return res.status(500).json({ error: 'Failed to log out. Server error.' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie from the client's browser
        console.log('User logged out. Session destroyed.');
        res.status(200).json({ message: 'Logged out successfully.' });
    });
});

// Route to check current session status (no isAuthenticated, as it's for checking status)
app.get('/session-status', (req, res) => {
    if (req.session.userId) {
        res.status(200).json({
            isLoggedIn: true,
            userId: req.session.userId,
            role: req.session.role,
            userName: req.session.userName,
            userEmail: req.session.userEmail // Include userEmail
        });
    } else {
        res.status(200).json({ isLoggedIn: false });
    }
});

// --- User Management Routes (Admin Panel - require admin role) ---

// GET all users (accessible by admin, doctor, nurse, and lab_technician roles)
app.get('/api/users', isAuthenticated, (req, res) => {
    let query = 'SELECT id, name, email, role FROM users';
    const params = [];

    // Doctors, Nurses, Lab Techs, Pharmacists, and Receptionists only see patients
    if (['doctor', 'nurse', 'lab_technician', 'pharmacist', 'receptionist'].includes(req.session.role)) { // ⭐ ADDED RECEPTIONIST HERE ⭐
        query += ' WHERE role = "patient"';
    } else if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view user list.' });
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error fetching users:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// PUT update user role
app.put('/api/users/:id/role', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ error: 'Role is required.' });
    }

    // ⭐ UPDATED allowedRoles for role update ⭐
    const allowedRoles = ['patient', 'doctor', 'nurse', 'admin', 'receptionist', 'lab_technician', 'pharmacist'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function(err) {
        if (err) {
            console.error('Database error updating user role:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found or role already set.' });
        }
        res.status(200).json({ message: `User ID ${userId} role updated to ${role}.` });
    });
});

// Endpoint for admin to create a user with a specified role
app.post('/api/admin/users', isAuthenticated, authorizeRole('admin'), async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields (name, email, password, role) are required.' });
    }

    // ⭐ UPDATED allowedRoles for admin user creation ⭐
    const allowedRoles = ['patient', 'doctor', 'nurse', 'admin', 'receptionist', 'lab_technician', 'pharmacist'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    try {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error('Database error during admin user creation email check:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (row) {
                return res.status(409).json({ error: 'Email already registered.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role], function(insertErr) {
                if (insertErr) {
                    console.error('Database error during admin user insertion:', insertErr.message);
                    return res.status(500).json({ error: 'Internal server error.' });
                }
                console.log(`Admin created user: ${email} with role: ${role} (ID: ${this.lastID})`);
                res.status(201).json({ message: `User ${name} created successfully with role ${role}!` });
            });
        });
    } catch (error) {
        console.error('Error during admin user creation process:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// DELETE a user (requires admin role)
app.delete('/api/users/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const userId = req.params.id;

    // Use serialize for sequential operations to ensure atomicity
    db.serialize(() => {
        db.run('BEGIN TRANSACTION;');

        // Delete from doctors table if this user is a doctor
        db.run('DELETE FROM doctors WHERE user_id = ?', [userId], function(err) {
            if (err) {
                console.error('Database error deleting doctor associated with user:', err.message);
                db.run('ROLLBACK;');
                return res.status(500).json({ error: 'Failed to delete associated doctor entry.' });
            }
            // No need to check this.changes, as it might not be a doctor
        });

        // Delete from users table
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                console.error('Database error deleting user:', err.message);
                db.run('ROLLBACK;');
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                db.run('ROLLBACK;');
                return res.status(404).json({ error: 'User not found.' });
            }
            console.log(`User ID ${userId} deleted.`);
            db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                    console.error('Error committing transaction for user deletion:', commitErr.message);
                    return res.status(500).json({ error: 'Failed to finalize user deletion.' });
                }
                res.status(200).json({ message: `User ID ${userId} deleted successfully.` });
            });
        });
    });
});

// --- Doctor Management Routes ---

// GET all doctors (accessible by authenticated users, or all if `isAuthenticated` is removed)
app.get('/api/doctors', isAuthenticated, (req, res) => {
    db.all('SELECT id, user_id, name, email, specialization, phone, address, salary FROM doctors', [], (err, rows) => {
        if (err) {
            console.error('Database error fetching doctors:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// ⭐ NEW ENDPOINT: GET doctor by user_id ⭐
app.get('/api/doctors/by-user/:userId', isAuthenticated, (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid User ID provided.' });
    }

    // Ensure the requesting user is either an admin or the doctor themselves
    if (req.session.role === 'admin' || (req.session.role === 'doctor' && req.session.userId === userId)) {
        db.get('SELECT id, name, email, specialization FROM doctors WHERE user_id = ?', [userId], (err, row) => {
            if (err) {
                console.error(`Database error fetching doctor by user ID ${userId}:`, err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (!row) {
                console.log(`No doctor found for user ID ${userId}.`);
                return res.status(404).json({ error: 'Doctor not found for this user ID.' });
            }
            console.log(`Found doctor for user ID ${userId}: ${row.name} (Doctor ID: ${row.id})`);
            res.status(200).json(row);
        });
    } else {
        res.status(403).json({ error: 'Forbidden: You do not have permission to view this doctor profile.' });
    }
});


// POST a new doctor (and create user entry for them) (requires admin role)
app.post('/api/doctors', isAuthenticated, authorizeRole('admin'), async (req, res) => {
    const { name, email, password, specialization, phone, address, salary } = req.body;

    if (!name || !email || !password || !specialization || !phone || !address || salary === undefined) {
        return res.status(400).json({ error: 'All fields (name, email, password, specialization, phone, address, salary) are required.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
        if (err) {
            console.error('Database error during doctor creation email check:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (existingUser) {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION;');
                db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, 'doctor'], function(insertUserErr) {
                    if (insertUserErr) {
                        console.error('Database error inserting doctor into users table (transaction rollback):', insertUserErr.message);
                        db.run('ROLLBACK;');
                        return res.status(500).json({ error: 'Failed to create doctor user account.' });
                    }
                    const user_id = this.lastID;
                    db.run('INSERT INTO doctors (user_id, name, email, specialization, phone, address, salary) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [user_id, name, email, specialization, phone, address, salary],
                        function(insertDoctorErr) {
                            if (insertDoctorErr) {
                                console.error('Database error inserting doctor details (transaction rollback):', insertDoctorErr.message);
                                db.run('ROLLBACK;');
                                // Attempt to clean up the user entry if doctor insertion fails
                                db.run('DELETE FROM users WHERE id = ?', [user_id]);
                                return res.status(500).json({ error: 'Failed to save doctor details. User account rolled back.' });
                            }
                            db.run('COMMIT;', (commitErr) => {
                                if (commitErr) {
                                    console.error('Error committing transaction for doctor creation:', commitErr.message);
                                    return res.status(500).json({ error: 'Failed to finalize doctor creation.' });
                                }
                                console.log(`Doctor created: ${email} (User ID: ${user_id}, Doctor ID: ${this.lastID})`);
                                res.status(201).json({ message: 'Doctor added successfully!', doctorId: this.lastID, userId: user_id });
                            });
                        }
                    );
                });
            });
        } catch (error) {
            console.error('Error during doctor creation process (password hashing):', error);
            res.status(500).json({ error: 'An unexpected error occurred during password hashing.' });
        }
    });
});


// PUT update doctor details (requires admin role)
app.put('/api/doctors/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const doctorId = req.params.id;
    const { name, email, specialization, phone, address, salary } = req.body;

    if (!name || !email || !specialization || !phone || !address || salary === undefined) {
        return res.status(400).json({ error: 'All fields are required for update.' });
    }

    db.run('UPDATE doctors SET name = ?, email = ?, specialization = ?, phone = ?, address = ?, salary = ? WHERE id = ?',
        [name, email, specialization, phone, address, salary, doctorId],
        function(err) {
            if (err) {
                console.error('Database error updating doctor details:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Doctor not found or no changes made.' });
            }
            console.log(`Doctor ID ${doctorId} updated.`);
            res.status(200).json({ message: `Doctor ID ${doctorId} updated successfully.` });
        }
    );
});

// DELETE a doctor (requires admin role)
app.delete('/api/doctors/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const doctorId = req.params.id;

    db.get('SELECT user_id FROM doctors WHERE id = ?', [doctorId], (err, row) => {
        if (err) {
            console.error('Database error fetching doctor user_id:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Doctor not found.' });
        }
        const userId = row.user_id;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            db.run('DELETE FROM doctors WHERE id = ?', [doctorId], function(deleteDoctorErr) {
                if (deleteDoctorErr) {
                    console.error('Database error deleting doctor:', deleteDoctorErr.message);
                    db.run('ROLLBACK;');
                    return res.status(500).json({ error: 'Failed to delete doctor entry.' });
                }

                if (this.changes === 0) {
                    db.run('ROLLBACK;');
                    return res.status(404).json({ error: 'Doctor not found during deletion.' });
                }

                db.run('DELETE FROM users WHERE id = ? AND role = "doctor"', [userId], function(deleteUserErr) {
                    if (deleteUserErr) {
                        console.error('Database error deleting associated user for doctor:', deleteUserErr.message);
                        db.run('ROLLBACK;');
                        return res.status(500).json({ error: 'Failed to delete associated user account.' });
                    }

                    db.run('COMMIT;', (commitErr) => {
                        if (commitErr) {
                            console.error('Error committing transaction for doctor deletion:', commitErr.message);
                            return res.status(500).json({ error: 'Failed to finalize doctor deletion.' });
                        }
                        console.log(`Doctor ID ${doctorId} and associated user ID ${userId} deleted.`);
                        res.status(200).json({ message: `Doctor ID ${doctorId} deleted successfully.` });
                    });
                });
            });
        });
    });
});

// --- Appointment Management Routes ---

// Create a new appointment (requires patient role)
app.post('/api/appointments', isAuthenticated, authorizeRole('patient'), (req, res) => {
    const { doctor_id, appointment_date, appointment_time, reason } = req.body;
    const patient_id = req.session.userId; // Get patient_id from the session

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time || !reason) {
        return res.status(400).json({ error: 'All appointment fields are required: doctor, date, time, reason.' });
    }

    db.run(`INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [patient_id, doctor_id, appointment_date, appointment_time, reason, 'Pending'], function(err) {
        if (err) {
            console.error('Database error creating appointment:', err.message);
            return res.status(500).json({ error: 'Internal server error. Could not create appointment.' });
        }
        res.status(201).json({ message: 'Appointment created successfully!', appointmentId: this.lastID });
    });
});

// GET appointments for the logged-in user (patient, doctor, admin)
app.get('/api/appointments', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    const userId = req.session.userId;

    let query = `
        SELECT
            a.id AS appointment_id,
            a.appointment_date,
            a.appointment_time,
            a.reason,
            a.status,
            p.name AS patient_name,
            p.email AS patient_email,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
    `;
    const params = [];

    // Function to execute the query, called directly for patient/admin or from doctor callback
    const executeAppointmentQuery = () => { // Moved definition to the top
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error fetching appointments:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            res.status(200).json(rows);
        });
    };

    if (userRole === 'patient') {
        query += ' WHERE a.patient_id = ?';
        params.push(userId);
        executeAppointmentQuery(); // Call directly
    } else if (userRole === 'doctor') {
        // Find the doctor's ID in the doctors table based on user_id
        db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
            if (err || !doctorRow) {
                console.error('Error fetching doctor ID for logged-in doctor:', err ? err.message : 'Doctor not found.');
                return res.status(500).json({ error: 'Could not retrieve doctor information.' });
            }
            query += ' WHERE a.doctor_id = ?';
            params.push(doctorRow.id);
            executeAppointmentQuery(); // Call from callback
        });
    } else if (userRole === 'admin') { // Admin can view all appointments
        executeAppointmentQuery(); // Call directly
    } else {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view appointments.' });
    }
});

// PUT update appointment status (accessible by doctor or admin)
app.put('/api/appointments/:id/status', isAuthenticated, (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body;
    const userRole = req.session.role;
    const userId = req.session.userId;

    if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
    }

    const allowedStatuses = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    let updateQuery = 'UPDATE appointments SET status = ? WHERE id = ?';
    const updateParams = [status, appointmentId];

    const executeAppointmentUpdate = () => { // Moved definition to the top
        db.run(updateQuery, updateParams, function(err) {
            if (err) {
                console.error('Database error updating appointment status:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Appointment not found or you do not have permission to update it.' });
            }
            res.status(200).json({ message: `Appointment ID ${appointmentId} status updated to ${status}.` });
        });
    };

    if (userRole === 'doctor') {
        // Doctors can only update status of appointments assigned to them
        db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
            if (err || !doctorRow) {
                console.error('Error fetching doctor ID for logged-in doctor:', err ? err.message : 'Doctor not found.');
                return res.status(500).json({ error: 'Could not retrieve doctor information.' });
            }
            updateQuery += ' AND doctor_id = ?';
            updateParams.push(doctorRow.id);
            executeAppointmentUpdate();
        });
    } else if (userRole === 'admin') {
        executeAppointmentUpdate(); // Initial call for admin
    } else {
        return res.status(403).json({ error: 'Forbidden: Only admin or assigned doctor can update appointment status.' });
    }
});

// DELETE an appointment (accessible by admin or the patient who created it, or assigned doctor)
app.delete('/api/appointments/:id', isAuthenticated, (req, res) => {
    const appointmentId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userId;

    const executeDeleteAppointment = () => { // Moved definition to the top
        db.run('DELETE FROM appointments WHERE id = ?', [appointmentId], function(err) {
            if (err) {
                console.error('Database error deleting appointment:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Appointment not found or already deleted.' });
            }
            res.status(200).json({ message: `Appointment ID ${appointmentId} deleted successfully.` });
        });
    };

    // First, get the appointment details to check ownership
    db.get('SELECT patient_id, doctor_id FROM appointments WHERE id = ?', [appointmentId], (err, appointment) => {
        if (err) {
            console.error('Database error checking appointment ownership:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        let canDelete = false;
        if (userRole === 'admin') {
            canDelete = true;
        } else if (userRole === 'patient' && appointment.patient_id === userId) {
            canDelete = true;
        } else if (userRole === 'doctor') {
            db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
                if (err || !doctorRow) {
                    console.error('Error fetching doctor ID for logged-in doctor:', err ? err.message : 'Doctor not found.');
                    return res.status(500).json({ error: 'Could not retrieve doctor information for deletion.' });
                }
                if (appointment.doctor_id === doctorRow.id) {
                    canDelete = true;
                }

                if (canDelete) {
                    executeDeleteAppointment();
                } else {
                    res.status(403).json({ error: 'Forbidden: You do not have permission to delete this appointment.' });
                }
            });
            return; // Exit early, deletion will be executed in the callback
        }

        if (canDelete) {
            executeDeleteAppointment();
        } else {
            res.status(403).json({ error: 'Forbidden: You do not have permission to delete this appointment.' });
        }
    });
});


// --- Medical Records Management Routes ---

// Create a new medical record (requires doctor role)
app.post('/api/medical-records', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    const { patient_id, appointment_id, diagnosis, notes } = req.body;
    const doctor_user_id = req.session.userId;

    if (!patient_id || !diagnosis) {
        return res.status(400).json({ error: 'Patient ID and Diagnosis are required for a medical record.' });
    }

    db.get('SELECT id FROM doctors WHERE user_id = ?', [doctor_user_id], (err, doctorRow) => {
        if (err || !doctorRow) {
            console.error('Error fetching doctor ID for medical record creation:', err ? err.message : 'Doctor not found.');
            return res.status(500).json({ error: 'Could not retrieve doctor information.' });
        }
        const doctor_id = doctorRow.id;

        db.run(`INSERT INTO medical_records (patient_id, doctor_id, appointment_id, diagnosis, notes) VALUES (?, ?, ?, ?, ?)`,
            [patient_id, doctor_id, appointment_id, diagnosis, notes], function(err) {
            if (err) {
                console.error('Database error creating medical record:', err.message);
                return res.status(500).json({ error: 'Internal server error. Could not create medical record.' });
            }
            res.status(201).json({ message: 'Medical record created successfully!', recordId: this.lastID });
        });
    });
});

// GET medical records for a specific patient (accessible by patient (their own), doctor (their patients), admin)
app.get('/api/medical-records/:patient_id', isAuthenticated, (req, res) => {
    const requested_patient_id = parseInt(req.params.patient_id, 10);
    const userRole = req.session.role;
    const userId = req.session.userId;

    let query = `
        SELECT
            mr.id AS record_id,
            mr.diagnosis,
            mr.notes,
            mr.record_date,
            u.name AS patient_name,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization
        FROM medical_records mr
        JOIN users u ON mr.patient_id = u.id
        JOIN doctors d ON mr.doctor_id = d.id
        WHERE mr.patient_id = ?
    `;
    const params = [requested_patient_id];

    // Authorization logic
    if (userRole === 'patient') {
        if (requested_patient_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own medical records.' });
        }
    } else if (userRole === 'doctor') {
        // Doctors can see their patients' records. For now, any doctor can see any patient's record.
        // If we want to restrict doctors to only see records they created or for patients they've treated,
        // we'd need to add more complex WHERE clauses or checks.
        // For simplicity, current logic allows doctors to view any patient's record given the patient_id.
    } else if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view medical records.' });
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error fetching medical records:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// GET all medical records (admin only)
app.get('/api/medical-records', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const query = `
        SELECT
            mr.id AS record_id,
            mr.diagnosis,
            mr.notes,
            mr.record_date,
            u.name AS patient_name,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization
        FROM medical_records mr
        JOIN users u ON mr.patient_id = u.id
        JOIN doctors d ON mr.doctor_id = d.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching all medical records:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});


// --- Prescription Management Routes ---

// Create a new prescription (requires doctor role)
app.post('/api/prescriptions', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    const { patient_id, medication_name, dosage, instructions, start_date, end_date } = req.body;
    const doctor_user_id = req.session.userId;

    if (!patient_id || !medication_name || !dosage || !start_date) {
        return res.status(400).json({ error: 'Patient ID, Medication Name, Dosage, and Start Date are required for a prescription.' });
    }

    db.get('SELECT id FROM doctors WHERE user_id = ?', [doctor_user_id], (err, doctorRow) => {
        if (err || !doctorRow) {
            console.error('Error fetching doctor ID for prescription creation:', err ? err.message : 'Doctor not found.');
            return res.status(500).json({ error: 'Could not retrieve doctor information.' });
        }
        const doctor_id = doctorRow.id;

        db.run(`INSERT INTO prescriptions (patient_id, doctor_id, medication_name, dosage, instructions, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [patient_id, doctor_id, medication_name, dosage, instructions, start_date, end_date], function(err) {
            if (err) {
                console.error('Database error creating prescription:', err.message);
                return res.status(500).json({ error: 'Internal server error. Could not create prescription.' });
            }
            res.status(201).json({ message: 'Prescription created successfully!', prescriptionId: this.lastID });
        });
    });
});

// GET prescriptions for a specific patient (accessible by patient (their own), doctor (their patients), admin, pharmacist)
app.get('/api/prescriptions/:patient_id', isAuthenticated, (req, res) => {
    const requested_patient_id = parseInt(req.params.patient_id, 10);
    const userRole = req.session.role;
    const userId = req.session.userId;

    let query = `
        SELECT
            p.id AS prescription_id,
            p.medication_name,
            p.dosage,
            p.instructions,
            p.start_date,
            p.end_date,
            p.created_at,
            u.name AS patient_name,
            d.name AS doctor_name
        FROM prescriptions p
        JOIN users u ON p.patient_id = u.id
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = ?
    `;
    const params = [requested_patient_id];

    if (userRole === 'patient') {
        if (requested_patient_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own prescriptions.' });
        }
    } else if (userRole === 'doctor' || userRole === 'pharmacist') { // ⭐ ADDED PHARMACIST HERE ⭐
        // Similar to medical records, doctors/pharmacists can view any patient's prescription for now.
    } else if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view prescriptions.' });
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error fetching prescriptions:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// GET all prescriptions (admin or pharmacist only)
app.get('/api/prescriptions', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'admin' && userRole !== 'pharmacist') { // ⭐ ADDED PHARMACIST HERE ⭐
        return res.status(403).json({ error: 'Forbidden: Only admin or pharmacist can view all prescriptions.' });
    }

    const query = `
        SELECT
            p.id AS prescription_id,
            p.medication_name,
            p.dosage,
            p.instructions,
            p.start_date,
            p.end_date,
            p.created_at,
            u.name AS patient_name,
            d.name AS doctor_name
        FROM prescriptions p
        JOIN users u ON p.patient_id = u.id
        JOIN doctors d ON p.doctor_id = d.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching all prescriptions:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});


// --- Doctor Schedule Management Routes ---

// Add a new doctor schedule entry (requires doctor or admin role)
app.post('/api/doctor-schedules', isAuthenticated, (req, res) => {
    const { doctor_id, schedule_date, start_time, end_time, status } = req.body;
    const userRole = req.session.role;
    const userId = req.session.userId;

    if (!doctor_id || !schedule_date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Doctor ID, Schedule Date, Start Time, and End Time are required.' });
    }

    // Authorization check: Doctors can only add schedules for themselves
    if (userRole === 'doctor') {
        db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
            if (err || !doctorRow) {
                console.error('Error fetching doctor ID for schedule creation:', err ? err.message : 'Doctor not found.');
                return res.status(500).json({ error: 'Could not retrieve doctor information.' });
            }
            if (doctorRow.id !== doctor_id) {
                return res.status(403).json({ error: 'Forbidden: Doctors can only add schedules for themselves.' });
            }
            executeAddSchedule(doctor_id);
        });
    } else if (userRole === 'admin') {
        executeAddSchedule(doctor_id);
    } else {
        return res.status(403).json({ error: 'Forbidden: Only doctors or admins can add schedules.' });
    }

    const executeAddSchedule = (docId) => {
        db.run(`INSERT INTO doctor_schedules (doctor_id, schedule_date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)`,
            [docId, schedule_date, start_time, end_time, status || 'Available'], function(err) {
            if (err) {
                console.error('Database error creating doctor schedule:', err.message);
                return res.status(500).json({ error: 'Internal server error. Could not create schedule.' });
            }
            res.status(201).json({ message: 'Doctor schedule added successfully!', scheduleId: this.lastID });
        });
    };
});

// Get doctor schedules (accessible by all authenticated users, showing doctor name)
app.get('/api/doctor-schedules', isAuthenticated, (req, res) => {
    const { doctorId } = req.query; // Optional: filter by doctorId
    let query = `
        SELECT
            ds.id AS schedule_id,
            ds.schedule_date,
            ds.start_time,
            ds.end_time,
            ds.status,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization
        FROM doctor_schedules ds
        JOIN doctors d ON ds.doctor_id = d.id
    `;
    const params = [];

    if (doctorId) {
        const parsedDoctorId = parseInt(doctorId, 10);
        if (isNaN(parsedDoctorId)) {
            return res.status(400).json({ error: 'Invalid Doctor ID provided for filtering schedules.' });
        }
        query += ' WHERE ds.doctor_id = ?';
        params.push(parsedDoctorId);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error fetching doctor schedules:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// Update doctor schedule entry (requires doctor or admin role)
app.put('/api/doctor-schedules/:id', isAuthenticated, (req, res) => {
    const scheduleId = req.params.id;
    const { doctor_id, schedule_date, start_time, end_time, status } = req.body;
    const userRole = req.session.role;
    const userId = req.session.userId;

    if (!schedule_date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Schedule Date, Start Time, and End Time are required for update.' });
    }

    // First, check if the schedule exists and get its original doctor_id
    db.get('SELECT doctor_id FROM doctor_schedules WHERE id = ?', [scheduleId], (err, scheduleRow) => {
        if (err) {
            console.error('Database error checking schedule existence:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!scheduleRow) {
            return res.status(404).json({ error: 'Schedule entry not found.' });
        }

        let canUpdate = false;
        if (userRole === 'admin') {
            canUpdate = true;
        } else if (userRole === 'doctor') {
            db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
                if (err || !doctorRow) {
                    console.error('Error fetching doctor ID for schedule update:', err ? err.message : 'Doctor not found.');
                    return res.status(500).json({ error: 'Could not retrieve doctor information.' });
                }
                if (scheduleRow.doctor_id === doctorRow.id) {
                    canUpdate = true;
                }
                if (canUpdate) {
                    executeScheduleUpdate(scheduleRow.doctor_id); // Use the original doctor_id from the schedule
                } else {
                    res.status(403).json({ error: 'Forbidden: You can only update your own schedules.' });
                }
            });
            return; // Exit early, update will be executed in the callback
        }

        if (canUpdate) {
            executeScheduleUpdate(scheduleRow.doctor_id); // Use the original doctor_id from the schedule
        } else {
            res.status(403).json({ error: 'Forbidden: You do not have permission to update this schedule.' });
        }
    });

    const executeScheduleUpdate = (original_doctor_id) => {
        // Ensure that doctor_id in the body, if provided, matches the original_doctor_id for doctors
        const final_doctor_id = (userRole === 'doctor' && doctor_id !== original_doctor_id) ? original_doctor_id : (doctor_id || original_doctor_id);

        db.run(`UPDATE doctor_schedules SET doctor_id = ?, schedule_date = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?`,
            [final_doctor_id, schedule_date, start_time, end_time, status || 'Available', scheduleId], function(err) {
            if (err) {
                console.error('Database error updating doctor schedule:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Schedule entry not found or no changes made.' });
            }
            res.status(200).json({ message: `Doctor schedule ID ${scheduleId} updated successfully!` });
        });
    };
});


// Delete doctor schedule entry (requires doctor or admin role)
app.delete('/api/doctor-schedules/:id', isAuthenticated, (req, res) => {
    const scheduleId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userId;

    // First, check if the schedule exists and get its original doctor_id
    db.get('SELECT doctor_id FROM doctor_schedules WHERE id = ?', [scheduleId], (err, scheduleRow) => {
        if (err) {
            console.error('Database error checking schedule existence for deletion:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!scheduleRow) {
            return res.status(404).json({ error: 'Schedule entry not found.' });
        }

        let canDelete = false;
        if (userRole === 'admin') {
            canDelete = true;
        } else if (userRole === 'doctor') {
            db.get('SELECT id FROM doctors WHERE user_id = ?', [userId], (err, doctorRow) => {
                if (err || !doctorRow) {
                    console.error('Error fetching doctor ID for schedule deletion:', err ? err.message : 'Doctor not found.');
                    return res.status(500).json({ error: 'Could not retrieve doctor information.' });
                }
                if (scheduleRow.doctor_id === doctorRow.id) {
                    canDelete = true;
                }
                if (canDelete) {
                    executeDeleteSchedule();
                } else {
                    res.status(403).json({ error: 'Forbidden: You do not have permission to delete this schedule.' });
                }
            });
            return; // Exit early, deletion will be executed in the callback
        }

        if (canDelete) {
            executeDeleteSchedule();
        } else {
            res.status(403).json({ error: 'Forbidden: You do not have permission to delete this schedule.' });
        }
    });

    const executeDeleteSchedule = () => {
        db.run('DELETE FROM doctor_schedules WHERE id = ?', [scheduleId], function(err) {
            if (err) {
                console.error('Database error deleting doctor schedule:', err.message);
                return res.status(500).json({ error: 'Internal server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Schedule entry not found or already deleted.' });
            }
            res.status(200).json({ message: `Doctor schedule ID ${scheduleId} deleted successfully.` });
        });
    };
});

// --- Emergency Cases API Routes ---

// POST a new emergency case (requires admin role)
app.post('/api/emergency-cases', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const { patient_id, patient_name, contact_info, emergency_type, description, severity, time_of_incident, assigned_doctor_id, assigned_nurse_ids, assigned_bed } = req.body;

    if (!emergency_type || !severity) {
        return res.status(400).json({ error: 'Emergency type and severity are required.' });
    }

    // Validate severity
    const allowedSeverities = ['Critical', 'Urgent', 'Stable'];
    if (!allowedSeverities.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity. Must be Critical, Urgent, or Stable.' });
    }

    // Handle assigned_nurse_ids as JSON string
    const nurseIdsJson = assigned_nurse_ids ? JSON.stringify(assigned_nurse_ids) : null;

    db.run(`INSERT INTO emergency_cases (patient_id, patient_name, contact_info, emergency_type, description, severity, time_of_incident, assigned_doctor_id, assigned_nurse_ids, assigned_bed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id || null, patient_name || null, contact_info || null, emergency_type, description || null, severity, time_of_incident || new Date().toISOString(), assigned_doctor_id || null, nurseIdsJson, assigned_bed || null],
        function(err) {
            if (err) {
                console.error('Database error inserting emergency case:', err.message);
                return res.status(500).json({ error: 'Failed to add emergency case. Server error.' });
            }
            res.status(201).json({ message: 'Emergency case added successfully!', caseId: this.lastID });
        }
    );
});

// GET all emergency cases (requires admin role)
app.get('/api/emergency-cases', isAuthenticated, authorizeRole('admin'), (req, res) => {
    // Query to fetch emergency cases, joining with users and doctors tables for names
    const query = `
        SELECT
            ec.id,
            ec.patient_id,
            ec.patient_name,
            ec.contact_info,
            ec.emergency_type,
            ec.description,
            ec.severity,
            ec.time_of_incident,
            ec.assigned_doctor_id,
            ec.assigned_nurse_ids,
            ec.assigned_bed,
            ec.current_status,
            ec.notes,
            ec.created_at,
            ec.updated_at,
            u.name AS registered_patient_name,
            d.name AS assigned_doctor_name
        FROM emergency_cases ec
        LEFT JOIN users u ON ec.patient_id = u.id
        LEFT JOIN doctors d ON ec.assigned_doctor_id = d.id
        ORDER BY ec.time_of_incident DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching emergency cases:', err.message);
            return res.status(500).json({ error: 'Failed to fetch emergency cases. Server error.' });
        }
        // Parse assigned_nurse_ids from JSON string back to array
        const cases = rows.map(row => ({
            ...row,
            assigned_nurse_ids: row.assigned_nurse_ids ? JSON.parse(row.assigned_nurse_ids) : []
        }));
        res.status(200).json(cases);
    });
});

// GET a single emergency case by ID (requires admin role)
app.get('/api/emergency-cases/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const caseId = req.params.id;
    const query = `
        SELECT
            ec.id,
            ec.patient_id,
            ec.patient_name,
            ec.contact_info,
            ec.emergency_type,
            ec.description,
            ec.severity,
            ec.time_of_incident,
            ec.assigned_doctor_id,
            ec.assigned_nurse_ids,
            ec.assigned_bed,
            ec.current_status,
            ec.notes,
            ec.created_at,
            ec.updated_at,
            u.name AS registered_patient_name,
            d.name AS assigned_doctor_name
        FROM emergency_cases ec
        LEFT JOIN users u ON ec.patient_id = u.id
        LEFT JOIN doctors d ON ec.assigned_doctor_id = d.id
        WHERE ec.id = ?
    `;

    db.get(query, [caseId], (err, row) => {
        if (err) {
            console.error('Database error fetching single emergency case:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Emergency case not found.' });
        }
        // Parse assigned_nurse_ids from JSON string back to array
        const emergencyCase = {
            ...row,
            assigned_nurse_ids: row.assigned_nurse_ids ? JSON.parse(row.assigned_nurse_ids) : []
        };
        res.status(200).json(emergencyCase);
    });
});

// PUT update an emergency case (requires admin role)
app.put('/api/emergency-cases/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const caseId = req.params.id;
    const { patient_id, patient_name, contact_info, emergency_type, description, severity, time_of_incident, assigned_doctor_id, assigned_nurse_ids, assigned_bed, current_status, notes } = req.body;

    // Validate severity and status
    const allowedSeverities = ['Critical', 'Urgent', 'Stable'];
    if (severity && !allowedSeverities.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity. Must be Critical, Urgent, or Stable.' });
    }
    const allowedStatuses = ['Triage', 'In Treatment', 'Stabilized', 'Awaiting Transfer', 'Discharged', 'Resolved', 'Deceased'];
    if (current_status && !allowedStatuses.includes(current_status)) {
        return res.status(400).json({ error: 'Invalid status. Must be Triage, In Treatment, Stabilized, Awaiting Transfer, Discharged, Resolved, or Deceased.' });
    }

    // Handle assigned_nurse_ids as JSON string
    const nurseIdsJson = assigned_nurse_ids ? JSON.stringify(assigned_nurse_ids) : null;

    db.run(`UPDATE emergency_cases SET
                patient_id = COALESCE(?, patient_id),
                patient_name = COALESCE(?, patient_name),
                contact_info = COALESCE(?, contact_info),
                emergency_type = COALESCE(?, emergency_type),
                description = COALESCE(?, description),
                severity = COALESCE(?, severity),
                time_of_incident = COALESCE(?, time_of_incident),
                assigned_doctor_id = COALESCE(?, assigned_doctor_id),
                assigned_nurse_ids = COALESCE(?, assigned_nurse_ids),
                assigned_bed = COALESCE(?, assigned_bed),
                current_status = COALESCE(?, current_status),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
        [patient_id, patient_name, contact_info, emergency_type, description, severity, time_of_incident, assigned_doctor_id, nurseIdsJson, assigned_bed, current_status, notes, caseId],
        function(err) {
            if (err) {
                console.error('Database error updating emergency case:', err.message);
                return res.status(500).json({ error: 'Failed to update emergency case. Server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Emergency case not found or no changes made.' });
            }
            res.status(200).json({ message: 'Emergency case updated successfully!' });
        }
    );
});

// DELETE an emergency case (requires admin role)
app.delete('/api/emergency-cases/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const caseId = req.params.id;

    db.run(`DELETE FROM emergency_cases WHERE id = ?`, [caseId], function(err) {
        if (err) {
            console.error('Database error deleting emergency case:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Emergency case not found.' });
        }
        res.status(200).json({ message: 'Emergency case deleted successfully!' });
    });
});

// --- Bed Management API Routes ---

// POST a new bed (requires admin role)
app.post('/api/beds', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const { bed_number, room_number, ward, status, current_patient_id } = req.body;

    if (!bed_number || !room_number || !ward || !status) {
        return res.status(400).json({ error: 'Bed Number, Room Number, Ward, and Status are required.' });
    }

    const allowedStatuses = ['Available', 'Occupied', 'Under Maintenance', 'Cleaning'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid bed status. Must be Available, Occupied, Under Maintenance, or Cleaning.' });
    }

    db.run(`INSERT INTO beds (bed_number, room_number, ward, status, current_patient_id) VALUES (?, ?, ?, ?, ?)`,
        [bed_number, room_number, ward, status, current_patient_id || null],
        function(err) {
            if (err) {
                console.error('Database error inserting bed:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Bed number already exists.' });
                }
                return res.status(500).json({ error: 'Failed to add bed. Server error.' });
            }
            res.status(201).json({ message: 'Bed added successfully!', bedId: this.lastID });
        }
    );
});

// GET all beds (requires admin or nurse role)
app.get('/api/beds', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'admin' && userRole !== 'nurse') {
        return res.status(403).json({ error: 'Forbidden: Only admin or nurse can view bed list.' });
    }

    const query = `
        SELECT
            b.id,
            b.bed_number,
            b.room_number,
            b.ward,
            b.status,
            b.current_patient_id,
            u.name AS current_patient_name,
            b.last_occupied_by_patient_id,
            lu.name AS last_occupied_patient_name,
            b.last_occupied_at,
            b.created_at,
            b.updated_at
        FROM beds b
        LEFT JOIN users u ON b.current_patient_id = u.id
        LEFT JOIN users lu ON b.last_occupied_by_patient_id = lu.id
        ORDER BY b.bed_number ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching beds:', err.message);
            return res.status(500).json({ error: 'Failed to fetch beds. Server error.' });
        }
        res.status(200).json(rows);
    });
});

// GET a single bed by ID (requires admin or nurse role)
app.get('/api/beds/:id', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'admin' && userRole !== 'nurse') {
        return res.status(403).json({ error: 'Forbidden: Only admin or nurse can view bed details.' });
    }

    const bedId = req.params.id;
    const query = `
        SELECT
            b.id,
            b.bed_number,
            b.room_number,
            b.ward,
            b.status,
            b.current_patient_id,
            u.name AS current_patient_name,
            b.last_occupied_by_patient_id,
            lu.name AS last_occupied_patient_name,
            b.last_occupied_at,
            b.created_at,
            b.updated_at
        FROM beds b
        LEFT JOIN users u ON b.current_patient_id = u.id
        LEFT JOIN users lu ON b.last_occupied_by_patient_id = lu.id
        WHERE b.id = ?
    `;
    db.get(query, [bedId], (err, row) => {
        if (err) {
            console.error('Database error fetching single bed:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Bed not found.' });
        }
        res.status(200).json(row);
    });
});

// PUT update a bed (requires admin or nurse role)
app.put('/api/beds/:id', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'admin' && userRole !== 'nurse') {
        return res.status(403).json({ error: 'Forbidden: Only admin or nurse can update bed details.' });
    }

    const bedId = req.params.id;
    const { bed_number, room_number, ward, status, current_patient_id } = req.body;

    const allowedStatuses = ['Available', 'Occupied', 'Under Maintenance', 'Cleaning'];
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid bed status. Must be Available, Occupied, Under Maintenance, or Cleaning.' });
    }

    // It's crucial to fetch the existing state to correctly update `last_occupied_by_patient_id` and `last_occupied_at`
    db.get('SELECT status, current_patient_id FROM beds WHERE id = ?', [bedId], (err, existingBed) => {
        if (err) {
            console.error('Database error checking existing bed status:', err.message);
            return res.status(500).json({ error: 'Server error during bed update.' });
        }
        if (!existingBed) {
            return res.status(404).json({ error: 'Bed not found.' });
        }

        let newCurrentPatientId = current_patient_id === undefined ? existingBed.current_patient_id : current_patient_id;
        let newLastOccupiedByPatientId = existingBed.current_patient_id; // Default to existing current patient
        let newLastOccupiedAt = existingBed.last_occupied_at; // Default to existing last occupied at

        // Logic for updating current_patient_id and last_occupied_by_patient_id/last_occupied_at
        // If status changes from Occupied to a non-occupied status, or if a new patient is assigned
        if (existingBed.status === 'Occupied' && status !== 'Occupied') {
            // Bed is becoming unoccupied, record the last patient
            newLastOccupiedByPatientId = existingBed.current_patient_id;
            newLastOccupiedAt = new Date().toISOString();
            newCurrentPatientId = null; // Clear current patient
        } else if (status === 'Occupied' && current_patient_id !== undefined && current_patient_id !== existingBed.current_patient_id) {
            // Bed is staying occupied but patient is changing, record the previous patient
            if (existingBed.current_patient_id) {
                newLastOccupiedByPatientId = existingBed.current_patient_id;
                newLastOccupiedAt = new Date().toISOString();
            }
        } else if (status !== 'Occupied') {
            // If the new status is explicitly not 'Occupied', ensure current_patient_id is null
            newCurrentPatientId = null;
        }


        let updateFields = [];
        let updateParams = [];

        // Admin can update all fields, nurse can only update status and current_patient_id
        if (userRole === 'admin') {
            if (bed_number !== undefined) { updateFields.push('bed_number = ?'); updateParams.push(bed_number); }
            if (room_number !== undefined) { updateFields.push('room_number = ?'); updateParams.push(room_number); }
            if (ward !== undefined) { updateFields.push('ward = ?'); updateParams.push(ward); }
        }
        
        // Both admin and nurse can update status and patient assignment
        if (status !== undefined) { updateFields.push('status = ?'); updateParams.push(status); }
        updateFields.push('current_patient_id = ?'); updateParams.push(newCurrentPatientId);
        updateFields.push('last_occupied_by_patient_id = ?'); updateParams.push(newLastOccupiedByPatientId);
        updateFields.push('last_occupied_at = ?'); updateParams.push(newLastOccupiedAt);
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        const updateQuery = `UPDATE beds SET ${updateFields.join(', ')} WHERE id = ?`;
        updateParams.push(bedId);

        db.run(updateQuery, updateParams, function(updateErr) {
            if (updateErr) {
                console.error('Database error updating bed:', updateErr.message);
                if (updateErr.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Bed number already exists.' });
                }
                return res.status(500).json({ error: 'Failed to update bed. Server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Bed not found or no changes made.' });
            }
            res.status(200).json({ message: 'Bed updated successfully!' });
        });
    });
});

// DELETE a bed (requires admin role)
app.delete('/api/beds/:id', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const bedId = req.params.id;

    db.run(`DELETE FROM beds WHERE id = ?`, [bedId], function(err) {
        if (err) {
            console.error('Database error deleting bed:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Bed not found.' });
        }
        res.status(200).json({ message: 'Bed deleted successfully!' });
    });
});


// GET available resources (doctors, nurses, beds) (requires admin role)
app.get('/api/available-resources', isAuthenticated, authorizeRole('admin'), async (req, res) => {
    try {
        const doctors = await new Promise((resolve, reject) => {
            db.all('SELECT id, name, specialization FROM doctors', [], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        const nurses = await new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM users WHERE role = "nurse"', [], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Fetch actual available beds from the beds table
        const availableBeds = await new Promise((resolve, reject) => {
            db.all('SELECT id, bed_number FROM beds WHERE status = "Available"', [], (err, rows) => {
                if (err) reject(err);
                resolve(rows.map(row => ({ id: row.id, bed_number: row.bed_number }))); // Map to simpler objects
            });
        });

        res.status(200).json({ doctors, nurses, beds: availableBeds });
    } catch (error) {
        console.error('Error fetching available resources:', error.message);
        res.status(500).json({ error: 'Failed to fetch available resources. Server error.' });
    }
});

// --- Lab Reports API Routes (NEW) ---

// POST a new lab report (requires lab_technician role)
app.post('/api/lab-reports', isAuthenticated, authorizeRole('lab_technician'), (req, res) => {
    const { patient_id, patient_name, test_type, test_date, results, notes, status } = req.body;
    const lab_technician_id = req.session.userId;

    if (!patient_id || !patient_name || !test_type || !test_date || !results || !status) {
        return res.status(400).json({ error: 'Patient ID, Patient Name, Test Type, Test Date, Results, and Status are required for a lab report.' });
    }

    const allowedStatuses = ['Pending', 'Completed', 'Awaiting Review'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid report status. Must be Pending, Completed, or Awaiting Review.' });
    }

    db.run(`INSERT INTO lab_reports (patient_id, patient_name, test_type, test_date, results, notes, status, lab_technician_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, patient_name, test_type, test_date, results, notes || null, status, lab_technician_id],
        function(err) {
            if (err) {
                console.error('Database error inserting lab report:', err.message);
                return res.status(500).json({ error: 'Failed to add lab report. Server error.' });
            }
            res.status(201).json({ message: 'Lab report added successfully!', reportId: this.lastID });
        }
    );
});

// GET all lab reports (requires lab_technician or admin role)
app.get('/api/lab-reports', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'lab_technician' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Only lab technicians or admins can view lab reports.' });
    }

    const query = `
        SELECT
            lr.id,
            lr.patient_id,
            lr.patient_name,
            lr.test_type,
            lr.test_date,
            lr.results,
            lr.notes,
            lr.status,
            lr.lab_technician_id,
            u.name AS lab_technician_name,
            lr.created_at,
            lr.updated_at
        FROM lab_reports lr
        JOIN users u ON lr.lab_technician_id = u.id
        ORDER BY lr.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching lab reports:', err.message);
            return res.status(500).json({ error: 'Failed to fetch lab reports. Server error.' });
        }
        res.status(200).json(rows);
    });
});

// GET lab reports for a specific patient (accessible by patient, doctor, or admin)
// This is the new endpoint for patients to view their own reports
app.get('/api/lab-reports/patient/:patient_id', isAuthenticated, (req, res) => {
    const patientId = parseInt(req.params.patient_id, 10);
    const userRole = req.session.role;
    const sessionUserId = req.session.userId;

    // Authorization: Patient can only view their own reports
    if (userRole === 'patient' && patientId !== sessionUserId) {
        return res.status(403).json({ error: 'Forbidden: Patients can only view their own lab reports.' });
    }
    // Doctors and Admins can view any patient's reports
    else if (!['patient', 'doctor', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden: Your role does not allow viewing lab reports.' });
    }

    const query = `
        SELECT
            lr.id,
            lr.patient_id,
            lr.patient_name,
            lr.test_type,
            lr.test_date,
            lr.results,
            lr.notes,
            lr.status,
            lr.lab_technician_id,
            u.name AS lab_technician_name,
            lr.created_at,
            lr.updated_at
        FROM lab_reports lr
        JOIN users u ON lr.lab_technician_id = u.id
        WHERE lr.patient_id = ?
        ORDER BY lr.created_at DESC
    `;
    db.all(query, [patientId], (err, rows) => {
        if (err) {
            console.error('Database error fetching patient lab reports:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});


// GET a single lab report by ID (requires lab_technician or admin role)
app.get('/api/lab-reports/:id', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'lab_technician' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Only lab technicians or admins can view lab report details.' });
    }

    const reportId = req.params.id;
    const query = `
        SELECT
            lr.id,
            lr.patient_id,
            lr.patient_name,
            lr.test_type,
            lr.test_date,
            lr.results,
            lr.notes,
            lr.status,
            lr.lab_technician_id,
            u.name AS lab_technician_name,
            lr.created_at,
            lr.updated_at
        FROM lab_reports lr
        JOIN users u ON lr.lab_technician_id = u.id
        WHERE lr.id = ?
    `;
    db.get(query, [reportId], (err, row) => {
        if (err) {
            console.error('Database error fetching single lab report:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Lab report not found.' });
        }
        res.status(200).json(row);
    });
});

// PUT update a lab report (requires lab_technician role)
app.put('/api/lab-reports/:id', isAuthenticated, authorizeRole('lab_technician'), (req, res) => {
    const reportId = req.params.id;
    const { patient_id, patient_name, test_type, test_date, results, notes, status } = req.body;
    const lab_technician_id = req.session.userId; // Ensure only the creating technician or admin can update

    if (!patient_id || !patient_name || !test_type || !test_date || !results || !status) {
        return res.status(400).json({ error: 'All fields (Patient ID, Patient Name, Test Type, Test Date, Results, Status) are required for update.' });
    }

    const allowedStatuses = ['Pending', 'Completed', 'Awaiting Review'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid report status. Must be Pending, Completed, or Awaiting Review.' });
    }

    db.run(`UPDATE lab_reports SET
                patient_id = ?,
                patient_name = ?,
                test_type = ?,
                test_date = ?,
                results = ?,
                notes = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND lab_technician_id = ?`, // Only technician who created it can update
        [patient_id, patient_name, test_type, test_date, results, notes || null, status, reportId, lab_technician_id],
        function(err) {
            if (err) {
                console.error('Database error updating lab report:', err.message);
                return res.status(500).json({ error: 'Failed to update lab report. Server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Lab report not found or you do not have permission to update it.' });
            }
            res.status(200).json({ message: 'Lab report updated successfully!' });
        }
    );
});

// DELETE a lab report (requires lab_technician role)
app.delete('/api/lab-reports/:id', isAuthenticated, authorizeRole('lab_technician'), (req, res) => {
    const reportId = req.params.id;
    const lab_technician_id = req.session.userId; // Ensure only the creating technician or admin can delete

    db.run(`DELETE FROM lab_reports WHERE id = ? AND lab_technician_id = ?`, [reportId, lab_technician_id], function(err) {
        if (err) {
            console.error('Database error deleting lab report:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Lab report not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Lab report deleted successfully!' });
    });
});

// --- Inventory Management API Routes (NEW) ---

// POST a new inventory item (requires pharmacist or admin role)
app.post('/api/inventory', isAuthenticated, (req, res) => {
    const { item_name, category, quantity, unit, price, expiry_date, supplier } = req.body;
    const last_updated_by = req.session.userId;
    const userRole = req.session.role;

    if (userRole !== 'pharmacist' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Only pharmacists or admins can add inventory items.' });
    }

    if (!item_name || !quantity || !unit || !price) {
        return res.status(400).json({ error: 'Item Name, Quantity, Unit, and Price are required.' });
    }
    if (quantity < 0 || price < 0) {
        return res.status(400).json({ error: 'Quantity and Price cannot be negative.' });
    }

    db.run(`INSERT INTO inventory (item_name, category, quantity, unit, price, expiry_date, supplier, last_updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [item_name, category || null, quantity, unit, price, expiry_date || null, supplier || null, last_updated_by],
        function(err) {
            if (err) {
                console.error('Database error inserting inventory item:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Item with this name already exists.' });
                }
                return res.status(500).json({ error: 'Failed to add inventory item. Server error.' });
            }
            res.status(201).json({ message: 'Inventory item added successfully!', itemId: this.lastID });
        }
    );
});

// GET all inventory items (requires pharmacist, nurse, or admin role)
app.get('/api/inventory', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole !== 'pharmacist' && userRole !== 'admin' && userRole !== 'nurse' && userRole !== 'receptionist') { // ⭐ ADDED RECEPTIONIST HERE ⭐
        return res.status(403).json({ error: 'Forbidden: Only pharmacists, nurses, admins, or receptionists can view inventory.' });
    }

    const query = `
        SELECT
            i.id,
            i.item_name,
            i.category,
            i.quantity,
            i.unit,
            i.price,
            i.expiry_date,
            i.supplier,
            i.last_updated_by,
            u.name AS last_updated_by_name,
            i.created_at,
            i.updated_at
        FROM inventory i
        LEFT JOIN users u ON i.last_updated_by = u.id
        ORDER BY i.item_name ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching inventory items:', err.message);
            return res.status(500).json({ error: 'Failed to fetch inventory items. Server error.' });
        }
        res.status(200).json(rows);
    });
});

// PUT update an inventory item (requires pharmacist, nurse, or admin role)
app.put('/api/inventory/:id', isAuthenticated, (req, res) => {
    const itemId = req.params.id;
    const { item_name, category, quantity, unit, price, expiry_date, supplier } = req.body;
    const last_updated_by = req.session.userId;
    const userRole = req.session.role;

    // Fetch current item to check quantity if role is nurse
    db.get('SELECT quantity FROM inventory WHERE id = ?', [itemId], (err, existingItem) => {
        if (err) {
            console.error('Database error fetching existing inventory item:', err.message);
            return res.status(500).json({ error: 'Server error during inventory update.' });
        }
        if (!existingItem) {
            return res.status(404).json({ error: 'Inventory item not found.' });
        }

        let updateFields = [];
        let updateParams = [];

        if (userRole === 'nurse') {
            // Nurse can ONLY update quantity, and only to decrement it
            if (quantity === undefined || typeof quantity !== 'number' || quantity < 0) {
                return res.status(400).json({ error: 'Nurse can only specify a valid positive quantity to use.' });
            }
            if (quantity > existingItem.quantity) {
                return res.status(400).json({ error: 'Nurse cannot increase inventory quantity or use more than available.' });
            }
            updateFields.push('quantity = ?');
            updateParams.push(quantity);
        } else if (userRole === 'pharmacist' || userRole === 'admin') {
            // Pharmacist and Admin can update all fields
            if (!item_name || quantity === undefined || !unit || price === undefined) {
                return res.status(400).json({ error: 'Item Name, Quantity, Unit, and Price are required for update.' });
            }
            if (quantity < 0 || price < 0) {
                return res.status(400).json({ error: 'Quantity and Price cannot be negative.' });
            }

            updateFields.push('item_name = ?'); updateParams.push(item_name);
            updateFields.push('category = ?'); updateParams.push(category || null);
            updateFields.push('quantity = ?'); updateParams.push(quantity);
            updateFields.push('unit = ?'); updateParams.push(unit);
            updateFields.push('price = ?'); updateParams.push(price);
            updateFields.push('expiry_date = ?'); updateParams.push(expiry_date || null);
            updateFields.push('supplier = ?'); updateParams.push(supplier || null);
        } else {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to update inventory items.' });
        }

        updateFields.push('last_updated_by = ?'); updateParams.push(last_updated_by);
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        const updateQuery = `UPDATE inventory SET ${updateFields.join(', ')} WHERE id = ?`;
        updateParams.push(itemId);

        db.run(updateQuery, updateParams, function(updateErr) {
            if (updateErr) {
                console.error('Database error updating inventory item:', updateErr.message);
                if (updateErr.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Item with this name already exists.' });
                }
                return res.status(500).json({ error: 'Failed to update inventory item. Server error.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Inventory item not found or no changes made.' });
            }
            res.status(200).json({ message: 'Inventory item updated successfully!' });
        });
    });
});

// DELETE an inventory item (requires pharmacist or admin role)
app.delete('/api/inventory/:id', isAuthenticated, (req, res) => {
    const itemId = req.params.id;
    const userRole = req.session.role;

    if (userRole !== 'pharmacist' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Only pharmacists or admins can delete inventory items.' });
    }

    db.run(`DELETE FROM inventory WHERE id = ?`, [itemId], function(err) {
        if (err) {
            console.error('Database error deleting inventory item:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Inventory item not found.' });
        }
        res.status(200).json({ message: 'Inventory item deleted successfully!' });
    });
});

// ⭐ NEW: POST medicine usage (for Nurse) ⭐
app.post('/api/medicine-usage', isAuthenticated, authorizeRoles(['nurse', 'admin']), async (req, res) => {
    const { patient_id, item_id, quantity_used } = req.body;
    const billed_by_user_id = req.session.userId; // The nurse's user ID

    if (!patient_id || !item_id || !quantity_used || quantity_used <= 0) {
        return res.status(400).json({ error: 'Patient ID, Item ID, and a positive Quantity Used are required.' });
    }

    try {
        // 1. Fetch inventory item details
        const inventoryItem = await new Promise((resolve, reject) => {
            db.get('SELECT item_name, price, quantity FROM inventory WHERE id = ?', [item_id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!inventoryItem) {
            return res.status(404).json({ error: `Medicine with ID ${item_id} not found in inventory.` });
        }
        if (inventoryItem.quantity < quantity_used) {
            return res.status(400).json({ error: `Not enough ${inventoryItem.item_name} in stock. Available: ${inventoryItem.quantity}, Requested: ${quantity_used}.` });
        }

        const item_total_price = inventoryItem.price * quantity_used;

        // 2. Fetch patient name
        const patient = await new Promise((resolve, reject) => {
            db.get('SELECT name FROM users WHERE id = ? AND role = "patient"', [patient_id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!patient) {
            return res.status(404).json({ error: `Patient with ID ${patient_id} not found.` });
        }

        // Start a transaction for atomicity
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            // 3. Update inventory quantity
            db.run('UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [quantity_used, item_id],
                function(updateInventoryErr) {
                    if (updateInventoryErr) {
                        console.error('Database error updating inventory quantity for medicine usage:', updateInventoryErr.message);
                        db.run('ROLLBACK;');
                        return res.status(500).json({ error: 'Failed to update inventory. Transaction rolled back.' });
                    }

                    // 4. Record usage in the bills table (as a specific type of bill)
                    const medicines_to_save = [{
                        item_id: item_id,
                        item_name: inventoryItem.item_name,
                        quantity: quantity_used,
                        unit_price: inventoryItem.price,
                        total_price_for_item: item_total_price
                    }];

                    db.run(`INSERT INTO bills (patient_id, appointment_charge, treatment_details, medicines_used_json, total_medicine_charge, total_bill, billed_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            patient_id,
                            0.00, // No appointment charge for direct medicine usage
                            `Medicine dispensed by nurse for ${patient.name} (${inventoryItem.item_name} x ${quantity_used})`,
                            JSON.stringify(medicines_to_save),
                            item_total_price,
                            item_total_price, // Total bill is just medicine charge
                            billed_by_user_id
                        ],
                        function(insertBillErr) {
                            if (insertBillErr) {
                                console.error('Database error inserting medicine usage bill:', insertBillErr.message);
                                db.run('ROLLBACK;');
                                return res.status(500).json({ error: 'Failed to record medicine usage. Transaction rolled back.' });
                            }
                            const billId = this.lastID;
                            db.run('COMMIT;', (commitErr) => {
                                if (commitErr) {
                                    console.error('Error committing medicine usage transaction:', commitErr.message);
                                    return res.status(500).json({ error: 'Failed to finalize medicine usage record.' });
                                }
                                console.log(`Medicine usage recorded for patient ${patient_id}: Bill ID ${billId}`);
                                res.status(201).json({ message: 'Medicine usage recorded successfully!', billId: billId });
                            });
                        }
                    );
                }
            );
        });

    } catch (error) {
        console.error('Error processing medicine usage:', error);
        res.status(500).json({ error: error.message || 'Failed to record medicine usage. Server error.' });
    }
});


// --- Announcement API Routes (NEW) ---

// POST a new announcement (requires admin role)
app.post('/api/announcements', isAuthenticated, authorizeRole('admin'), async (req, res) => {
    const { title, message, target_role } = req.body;
    const sent_by_user_id = req.session.userId;

    if (!title || !message || !target_role) {
        return res.status(400).json({ error: 'Title, message, and target role are required for an announcement.' });
    }

    const allowedTargetRoles = ['all', 'patient', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'admin', 'doctor_nurse'];
    if (!allowedTargetRoles.includes(target_role)) {
        return res.status(400).json({ error: 'Invalid target role specified.' });
    }

    try {
        // 1. Store the announcement in the database
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO announcements (title, message, target_role, sent_by_user_id) VALUES (?, ?, ?, ?)`,
                [title, message, target_role, sent_by_user_id], function(err) {
                if (err) {
                    console.error('Database error inserting announcement:', err.message);
                    reject('Failed to save announcement.');
                } else {
                    console.log(`Announcement saved: ID ${this.lastID}, Target: ${target_role}`);
                    resolve();
                }
            });
        });

        // 2. Fetch target user emails
        let emailQuery = 'SELECT email FROM users';
        const emailParams = [];

        if (target_role === 'patient' || target_role === 'doctor' || target_role === 'nurse' ||
            target_role === 'pharmacist' || target_role === 'lab_technician' || target_role === 'admin') {
            emailQuery += ' WHERE role = ?';
            emailParams.push(target_role);
        } else if (target_role === 'doctor_nurse') {
            emailQuery += ' WHERE role = "doctor" OR role = "nurse"';
        }
        // If target_role is 'all', no WHERE clause is needed

        const targetEmails = await new Promise((resolve, reject) => {
            db.all(emailQuery, emailParams, (err, rows) => {
                if (err) {
                    console.error('Database error fetching target emails for announcement:', err.message);
                    reject('Failed to fetch target emails.');
                }
                resolve(rows.map(row => row.email));
            });
        });

        // ⭐ Actual Email Sending using Nodemailer ⭐
        if (targetEmails.length > 0) {
            const emailSubject = `[HMS Announcement] ${title}`;
            const emailHtml = `
                <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #334155; background-color: #f0f4f8; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #1e40af; margin-bottom: 15px;">${title}</h2>
                    <p style="margin-bottom: 10px;">Dear HMS User,</p>
                    <p style="margin-bottom: 20px;">${message}</p>
                    <p style="font-size: 0.9em; color: #64748b;">This announcement was sent to all users with the role: <strong>${target_role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>.</p>
                    <p style="font-size: 0.9em; color: #64748b;">Thank you,<br>HMS Administration</p>
                </div>
            `;

            const sendResult = await sendEmail(targetEmails.join(', '), emailSubject, emailHtml);

            if (sendResult.success) {
                console.log(`Successfully sent email to: ${targetEmails.join(', ')}`);
                res.status(201).json({ message: 'Announcement sent and saved successfully!', recipients: targetEmails.length });
            } else {
                console.error(`Failed to send email: ${sendResult.error}`);
                res.status(500).json({ error: `Failed to send announcement email: ${sendResult.error}` });
            }
        } else {
            console.log(`No users found for target role: ${target_role}. No emails sent.`);
            res.status(200).json({ message: 'Announcement saved, but no recipients found for the specified role.', recipients: 0 });
        }
        // ⭐ END Actual Email Sending using Nodemailer ⭐

    } catch (error) {
        console.error('Error processing announcement:', error);
        res.status(500).json({ error: error.message || 'Failed to send announcement. Server error.' });
    }
});

// GET all announcements (requires admin role)
app.get('/api/announcements', isAuthenticated, authorizeRole('admin'), (req, res) => {
    const query = `
        SELECT
            a.id,
            a.title,
            a.message,
            a.target_role,
            a.sent_at,
            u.name AS sent_by_name
        FROM announcements a
        JOIN users u ON a.sent_by_user_id = u.id
        ORDER BY a.sent_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error fetching announcements:', err.message);
            return res.status(500).json({ error: 'Failed to fetch announcements. Server error.' });
        }
        res.status(200).json(rows);
    });
});

// --- Billing API Routes (NEW) ---

// GET all patients (for dropdowns) - accessible by admin and receptionist
app.get('/api/patients-for-dropdown', isAuthenticated, authorizeRoles(['admin', 'receptionist', 'nurse']), (req, res) => { // ⭐ ADDED NURSE HERE ⭐
    db.all('SELECT id, name FROM users WHERE role = "patient" ORDER BY name ASC', [], (err, rows) => {
        if (err) {
            console.error('Database error fetching patients for dropdown:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// GET inventory items (for medicine dropdowns) - accessible by admin, receptionist, pharmacist, nurse
app.get('/api/inventory-items', isAuthenticated, authorizeRoles(['admin', 'receptionist', 'pharmacist', 'nurse']), (req, res) => {
    db.all('SELECT id, item_name, price, quantity FROM inventory WHERE quantity > 0 ORDER BY item_name ASC', [], (err, rows) => {
        if (err) {
            console.error('Database error fetching inventory items:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.status(200).json(rows);
    });
});

// POST a new bill - accessible by admin and receptionist
app.post('/api/bills', isAuthenticated, authorizeRoles(['admin', 'receptionist']), async (req, res) => {
    const { patient_id, appointment_id, appointment_charge, treatment_details, medicines_used } = req.body;
    const billed_by_user_id = req.session.userId;

    if (!patient_id || appointment_charge === undefined || !Array.isArray(medicines_used)) {
        return res.status(400).json({ error: 'Patient ID, Appointment Charge, and Medicines Used array are required.' });
    }

    let total_medicine_charge = 0;
    const medicines_to_save = [];

    // Validate medicines_used and calculate total_medicine_charge
    for (const item of medicines_used) {
        if (!item.item_id || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({ error: 'Invalid medicine item: item_id and positive quantity are required.' });
        }

        // Fetch current price and quantity from inventory to ensure accuracy and prevent over-billing/over-usage
        const inventoryItem = await new Promise((resolve, reject) => {
            db.get('SELECT item_name, price, quantity FROM inventory WHERE id = ?', [item.item_id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!inventoryItem) {
            return res.status(404).json({ error: `Medicine with ID ${item.item_id} not found in inventory.` });
        }
        if (inventoryItem.quantity < item.quantity) {
            return res.status(400).json({ error: `Not enough ${inventoryItem.item_name} in stock. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}.` });
        }

        const item_total_price = inventoryItem.price * item.quantity;
        total_medicine_charge += item_total_price;

        medicines_to_save.push({
            item_id: item.item_id,
            item_name: inventoryItem.item_name,
            quantity: item.quantity,
            unit_price: inventoryItem.price,
            total_price_for_item: item_total_price
        });
    }

    const total_bill = parseFloat(appointment_charge) + total_medicine_charge;

    try {
        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            // Insert the bill
            db.run(`INSERT INTO bills (patient_id, appointment_id, appointment_charge, treatment_details, medicines_used_json, total_medicine_charge, total_bill, billed_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    patient_id,
                    appointment_id || null,
                    appointment_charge,
                    treatment_details || null,
                    JSON.stringify(medicines_to_save),
                    total_medicine_charge,
                    total_bill,
                    billed_by_user_id
                ],
                function(insertBillErr) {
                    if (insertBillErr) {
                        console.error('Database error inserting bill:', insertBillErr.message);
                        db.run('ROLLBACK;');
                        return res.status(500).json({ error: 'Failed to save bill. Server error.' });
                    }
                    const billId = this.lastID;

                    // Update inventory quantities
                    let inventoryUpdatePromises = [];
                    for (const item of medicines_used) {
                        inventoryUpdatePromises.push(new Promise((resolve, reject) => {
                            db.run('UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                [item.quantity, item.item_id],
                                function(updateInventoryErr) {
                                    if (updateInventoryErr) {
                                        console.error('Database error updating inventory quantity:', updateInventoryErr.message);
                                        reject(updateInventoryErr);
                                    } else {
                                        resolve();
                                    }
                                }
                            );
                        }));
                    }

                    Promise.all(inventoryUpdatePromises)
                        .then(() => {
                            db.run('COMMIT;', (commitErr) => {
                                if (commitErr) {
                                    console.error('Error committing bill transaction:', commitErr.message);
                                    return res.status(500).json({ error: 'Failed to finalize bill transaction.' });
                                }
                                console.log(`Bill created for patient ${patient_id}: Bill ID ${billId}`);
                                res.status(201).json({ message: 'Bill generated and saved successfully!', billId: billId });
                            });
                        })
                        .catch(promiseErr => {
                            console.error('Error during inventory update within bill transaction:', promiseErr.message);
                            db.run('ROLLBACK;');
                            res.status(500).json({ error: 'Failed to update inventory during billing. Transaction rolled back.' });
                        });
                }
            );
        });
    } catch (error) {
        console.error('Error processing bill:', error);
        res.status(500).json({ error: error.message || 'Failed to generate bill. Server error.' });
    }
});

// GET a specific bill by ID - accessible by admin, receptionist, and patient (their own)
app.get('/api/bills/:id', isAuthenticated, async (req, res) => {
    const billId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userId;

    const query = `
        SELECT
            b.id AS bill_id,
            b.patient_id,
            u.name AS patient_name,
            u.email AS patient_email,
            b.appointment_id,
            b.appointment_charge,
            b.treatment_details,
            b.medicines_used_json,
            b.total_medicine_charge,
            b.total_bill,
            b.billed_at,
            bb.name AS billed_by_name
        FROM bills b
        JOIN users u ON b.patient_id = u.id
        JOIN users bb ON b.billed_by_user_id = bb.id
        WHERE b.id = ?
    `;

    db.get(query, [billId], (err, row) => {
        if (err) {
            console.error('Database error fetching bill:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Bill not found.' });
        }

        // Authorization check
        if (userRole === 'patient' && row.patient_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own bills.' });
        } else if (!['admin', 'receptionist', 'patient'].includes(userRole)) { // Patient already handled above
            return res.status(403).json({ error: 'Forbidden: You do not have permission to view bills.' });
        }

        // Parse medicines_used_json
        const bill = {
            ...row,
            medicines_used: row.medicines_used_json ? JSON.parse(row.medicines_used_json) : []
        };
        delete bill.medicines_used_json; // Remove the raw JSON string

        res.status(200).json(bill);
    });
});

// GET all bills for a specific patient - accessible by patient (their own), admin, receptionist
app.get('/api/bills/patient/:patient_id', isAuthenticated, (req, res) => {
    const requested_patient_id = parseInt(req.params.patient_id, 10);
    const userRole = req.session.role;
    const userId = req.session.userId;

    // Authorization: Patient can only view their own bills
    if (userRole === 'patient' && requested_patient_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own bills.' });
    } else if (!['admin', 'receptionist', 'patient'].includes(userRole)) { // Patient already handled above
        return res.status(403).json({ error: 'Forbidden: You do not have permission to view bills.' });
    }

    const query = `
        SELECT
            b.id AS bill_id,
            b.patient_id,
            u.name AS patient_name,
            b.appointment_id,
            b.appointment_charge,
            b.treatment_details,
            b.medicines_used_json,
            b.total_medicine_charge,
            b.total_bill,
            b.billed_at,
            bb.name AS billed_by_name
        FROM bills b
        JOIN users u ON b.patient_id = u.id
        JOIN users bb ON b.billed_by_user_id = bb.id
        WHERE b.patient_id = ?
        ORDER BY b.billed_at DESC
    `;
    db.all(query, [requested_patient_id], (err, rows) => {
        if (err) {
            console.error('Database error fetching patient bills:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        // Parse medicines_used_json for each bill
        const bills = rows.map(row => ({
            ...row,
            medicines_used: row.medicines_used_json ? JSON.parse(row.medicines_used_json) : []
        }));
        res.status(200).json(bills);
    });
});

// ⭐ NEW ENDPOINT: GET medicine usage records for a specific patient (from nurse usage logs) ⭐
app.get('/api/patient-medicine-usage/:patient_id', isAuthenticated, authorizeRoles(['admin', 'receptionist', 'nurse']), (req, res) => {
    const patientId = parseInt(req.params.patient_id, 10);

    // This query specifically targets bills created by nurses for medicine usage
    // We identify them by `appointment_charge = 0` and `treatment_details` containing the specific string.
    const query = `
        SELECT
            b.id AS bill_id,
            b.patient_id,
            b.medicines_used_json,
            b.total_medicine_charge,
            b.billed_at,
            bb.name AS billed_by_name
        FROM bills b
        JOIN users bb ON b.billed_by_user_id = bb.id
        WHERE b.patient_id = ?
          AND b.appointment_charge = 0
          AND b.treatment_details LIKE 'Medicine dispensed by nurse%'
        ORDER BY b.billed_at DESC;
    `;

    db.all(query, [patientId], (err, rows) => {
        if (err) {
            console.error('Database error fetching patient medicine usage:', err.message);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        // Parse medicines_used_json for each usage record
        const usageRecords = rows.map(row => ({
            ...row,
            medicines_used: row.medicines_used_json ? JSON.parse(row.medicines_used_json) : []
        }));
        res.status(200).json(usageRecords);
    });
});


// --- HTML Page Routes (Explicitly defined to require authentication) ---

// Serve the `front.html` file as the default entry point (no authentication needed for this page)
app.get('/', (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'front.html'));
});

// Explicitly serve front.html (no authentication needed)
app.get('/front.html', (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'front.html'));
});

// Explicitly serve nurse-dashboard.html (requires authentication for nurses)
app.get('/nurse-dashboard.html', isAuthenticated, authorizeRole('nurse'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'nurse-dashboard.html'));
});

// Explicitly serve doctor-dashboard.html (requires authentication for doctors)
app.get('/doctor-dashboard.html', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'doctor-dashboard.html'));
});

// Explicitly serve manage-roles.html (requires authentication for admins)
app.get('/manage-roles.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'manage-roles.html'));
});

// Explicitly serve user-dashboard.html (requires authentication for patients)
// Note: This was likely a placeholder or old name. We are now using patient-dashboard.html
app.get('/user-dashboard.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'user-dashboard.html'));
});

// Explicitly serve patient-dashboard.html (requires authentication for patients)
app.get('/patient-dashboard.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'patient-dashboard.html'));
});

// Explicitly serve appointment.html (requires authentication for patients)
app.get('/appointment.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'appointment.html'));
});

// Explicitly serve doc-appointment.html (requires authentication for doctors)
app.get('/doc-appointment.html', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'doc-appointment.html'));
});

// Explicitly serve admin-appointment.html (requires authentication for admins)
app.get('/admin-appointment.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-appointment.html'));
});

// Explicitly serve doc-patient-records.html (requires authentication for doctors)
app.get('/doc-patient-records.html', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'doc-patient-records.html'));
});

// Explicitly serve patient-medical-history.html (requires authentication for patients)
app.get('/patient-medical-history.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'patient-medical-history.html'));
});

// Explicitly serve patient-prescriptions.html (requires authentication for patients)
app.get('/patient-prescriptions.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
  res.sendFile(path.join(staticFilesDir, 'patient-prescriptions.html'));
});

// Explicitly serve doc-medication-prescription.html (requires authentication for doctors)
app.get('/doc-medication-prescription.html', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'doc-medication-prescription.html'));
});

// Explicitly serve admin-doctor-schedule.html (requires authentication for admins)
app.get('/admin-doctor-schedule.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-doctor-schedule.html'));
});

// ⭐ NEW ROUTE TO SERVE DOCTOR'S OWN SCHEDULE VIEW PAGE ⭐
app.get('/doctor-view-schedule.html', isAuthenticated, authorizeRole('doctor'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'doctor-view-schedule.html'));
});

// ⭐ NEW ROUTE TO SERVE PATIENT SETTINGS PAGE ⭐
app.get('/patient-settings.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'patient-settings.html'));
});

// ⭐ NEW ROUTE TO SERVE ADMIN EMERGENCY CASES PAGE ⭐
app.get('/admin-emergency-cases.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-emergency-cases.html'));
});

// ⭐ NEW ROUTE TO SERVE ADMIN PATIENT MANAGEMENT PAGE ⭐
app.get('/admin-patient-management.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-patient-management.html'));
});

// ⭐ NEW ROUTE TO SERVE ADMIN BED MANAGEMENT PAGE ⭐
app.get('/admin-bed-management.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-bed-management.html'));
});

// ⭐ NEW ROUTE TO SERVE NURSE BED MANAGEMENT PAGE ⭐
app.get('/nurse-bed-management.html', isAuthenticated, authorizeRole('nurse'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'nurse-bed-management.html'));
});

// ⭐ NEW ROUTE TO SERVE LAB TECHNICIAN DASHBOARD PAGE ⭐
app.get('/lab-dashboard.html', isAuthenticated, authorizeRole('lab_technician'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'lab-dashboard.html'));
});

// ⭐ NEW ROUTE TO SERVE LAB REPORTS PAGE (for Lab Technician) ⭐
app.get('/lab-reports.html', isAuthenticated, authorizeRole('lab_technician'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'lab-reports.html'));
});

// ⭐ NEW ROUTE TO SERVE PATIENT'S LAB REPORTS PAGE ⭐
app.get('/patient-lab-reports.html', isAuthenticated, authorizeRole('patient'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'patient-lab-reports.html'));
});

// ⭐ NEW ROUTE TO SERVE ADMIN LAB REPORTS PAGE ⭐
app.get('/admin-lab-reports.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-lab-reports.html'));
});

// ⭐ NEW ROUTE TO SERVE PHARMACIST DASHBOARD PAGE ⭐
app.get('/pharmacist-dashboard.html', isAuthenticated, authorizeRole('pharmacist'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'pharmacist-dashboard.html'));
});

// ⭐ NEW ROUTE TO SERVE INVENTORY MANAGEMENT PAGE (for Pharmacist) ⭐
app.get('/inventory-management.html', isAuthenticated, (req, res) => { // Authenticated, role check in JS
    const userRole = req.session.role;
    if (userRole === 'pharmacist' || userRole === 'admin') {
        res.sendFile(path.join(staticFilesDir, 'inventory-management.html'));
    } else {
        res.status(403).send('Forbidden: Only pharmacists and admins can access inventory management.');
    }
});

// ⭐ NEW ROUTE TO SERVE NURSE INVENTORY MANAGEMENT PAGE ⭐
app.get('/inventory-management-nurse.html', isAuthenticated, (req, res) => {
    const userRole = req.session.role;
    if (userRole === 'nurse' || userRole === 'admin') { // Admin can also view/use
        res.sendFile(path.join(staticFilesDir, 'inventory-management-nurse.html'));
    } else {
        res.status(403).send('Forbidden: Only nurses and admins can access this page.');
    }
});

// ⭐ NEW ROUTE TO SERVE ADMIN ANNOUNCEMENTS PAGE ⭐
app.get('/admin-announcements.html', isAuthenticated, authorizeRole('admin'), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'admin-announcements.html'));
});

// ⭐ NEW ROUTE TO SERVE BILLING PAGE ⭐
app.get('/billing-page.html', isAuthenticated, authorizeRoles(['admin', 'receptionist']), (req, res) => {
    res.sendFile(path.join(staticFilesDir, 'billing-page.html'));
});


// Generic 404 handler for unmatched routes (THIS MUST BE LAST)
app.use((req, res) => {
    res.status(404).send('Sorry, that page was not found! 🕵️');
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`🚀 Hospital Management System backend listening at http://localhost:${PORT}`);
    console.log('Routes available:');
    console.log(`  - POST /signup (User registration)`);
    console.log(`  - POST /login (User login)`);
    console.log(`  - POST /logout (User logout)`);
    console.log(`  - GET /session-status (Check login status)`);
    console.log(`  - GET /api/users (Admin/Doctor/Nurse/Lab Technician/Pharmacist/Receptionist: Get all users/patients)`);
    console.log(`  - PUT /api/users/:id/role (Admin: Update user role)`);
    console.log(`  - POST /api/admin/users (Admin: Create user with role)`);
    console.log(`  - DELETE /api/users/:id (Admin: Delete user)`);
    console.log(`  - GET /api/doctors (All authenticated: Get all doctors)`);
    console.log(`  - GET /api/doctors/by-user/:userId (All authenticated: Get doctor by user ID) ⭐ NEW ⭐`);
    console.log(`  - POST /api/doctors (Admin: Add new doctor)`);
    console.log(`  - PUT /api/doctors/:id (Admin: Update doctor)`);
    console.log(`  - DELETE /api/doctors/:id (Admin: Delete doctor)`);
    console.log(`  - POST /api/appointments (Patient: Create appointment)`);
    console.log(`  - GET /api/appointments (All authenticated: Get appointments)`);
    console.log(`  - PUT /api/appointments/:id/status (Doctor/Admin: Update appointment status)`);
    console.log(`  - DELETE /api/appointments/:id (Admin/Patient/Doctor: Delete appointment)`);
    console.log(`  - POST /api/medical-records (Doctor: Create medical record)`);
    console.log(`  - GET /api/medical-records/:patient_id (Patient/Doctor/Admin: Get patient's medical records)`);
    console.log(`  - GET /api/medical-records (Admin: Get all medical records)`);
    console.log(`  - POST /api/prescriptions (Doctor: Create prescription)`);
    console.log(`  - GET /api/prescriptions/:patient_id (Patient/Doctor/Admin/Pharmacist: Get patient's prescriptions)`);
    console.log(`  - GET /api/prescriptions (Admin/Pharmacist: Get all prescriptions)`);
    console.log(`  - POST /api/doctor-schedules (Doctor/Admin: Add doctor schedule)`);
    console.log(`  - GET /api/doctor-schedules (All authenticated: Get doctor schedules)`);
    console.log(`  - PUT /api/doctor-schedules/:id (Doctor/Admin: Update doctor schedule)`);
    console.log(`  - DELETE /api/doctor-schedules/:id (Doctor/Admin: Delete doctor schedule)`);
    console.log(`  - POST /api/emergency-cases (Admin: Create emergency case)`);
    console.log(`  - GET /api/emergency-cases (Admin: Get all emergency cases)`);
    console.log(`  - GET /api/emergency-cases/:id (Admin: Get single emergency case)`);
    console.log(`  - PUT /api/emergency-cases/:id (Admin: Update emergency case)`);
    console.log(`  - DELETE /api/emergency-cases/:id (Admin: Delete emergency case)`);
    console.log(`  - POST /api/beds (Admin: Add new bed)`);
    console.log(`  - GET /api/beds (Admin/Nurse: Get all beds)`);
    console.log(`  - GET /api/beds/:id (Admin/Nurse: Get single bed)`);
    console.log(`  - PUT /api/beds/:id (Admin/Nurse: Update bed)`);
    console.log(`  - DELETE /api/beds/:id (Admin: Delete bed)`);
    console.log(`  - GET /api/available-resources (Admin: Get doctors, nurses, available beds)`);
    console.log(`  - POST /api/lab-reports (Lab Technician: Create lab report)`);
    console.log(`  - GET /api/lab-reports (Lab Technician/Admin: Get all lab reports)`);
    console.log(`  - GET /api/lab-reports/patient/:patient_id (Patient/Doctor/Admin: Get patient's lab reports)`);
    console.log(`  - GET /api/lab-reports/:id (Lab Technician/Admin: Get single lab report)`);
    console.log(`  - PUT /api/lab-reports/:id (Lab Technician: Update lab report)`);
    console.log(`  - DELETE /api/lab-reports/:id (Lab Technician: Delete lab report)`);
    console.log(`  - POST /api/inventory (Pharmacist/Admin: Add inventory item)`);
    console.log(`  - GET /api/inventory (Pharmacist/Admin/Nurse/Receptionist: Get all inventory items)`);
    console.log(`  - PUT /api/inventory/:id (Pharmacist/Admin/Nurse: Update inventory item - Nurse can only decrement quantity)`);
    console.log(`  - POST /api/medicine-usage (Nurse/Admin: Record medicine usage and update inventory)`);
    console.log(`  - DELETE /api/inventory/:id (Pharmacist/Admin: Delete inventory item)`);
    console.log(`  - POST /api/announcements (Admin: Create and send announcement)`);
    console.log(`  - GET /api/announcements (Admin: Get all announcements)`);
    console.log(`  - GET /api/patients-for-dropdown (Admin/Receptionist/Nurse: Get all registered patients for dropdown)`);
    console.log(`  - GET /api/inventory-items (Admin/Receptionist/Pharmacist/Nurse: Get inventory items with price/quantity)`);
    console.log(`  - POST /api/bills (Admin/Receptionist: Create a new bill)`);
    console.log(`  - GET /api/bills/:id (Admin/Receptionist/Patient: Get a specific bill)`);
    console.log(`  - GET /api/bills/patient/:patient_id (Admin/Receptionist/Patient: Get all bills for a patient)`);
    console.log(`  - GET /api/patient-medicine-usage/:patient_id (Admin/Receptionist/Nurse: Get medicine usage logs for a patient)`);
    console.log(`  - Serving static HTML files from: ${staticFilesDir}`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
