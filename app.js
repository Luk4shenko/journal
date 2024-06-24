const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt'); 

const app = express();
const port = 4000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

app.use(session({
    secret: 'the_most_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // установите в true если используете https
        httpOnly: true,
        maxAge: 60 * 60 * 1000 // 1 час
    }
}));

const saltRounds = 10;

// Подключение к базе данных SQLite
const db = new sqlite3.Database('./db/journal.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables(); // Создание таблиц при первом подключении
    }
});

// Функция для создания таблиц в базе данных
function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT,
        issuedBy TEXT,
        issueDate TEXT DEFAULT (datetime('now','localtime')),
        journalType TEXT,
        medicineType TEXT,
        journalNumber TEXT,
        additionalInfo TEXT,
        returnDate TEXT,
        returnConfirmed INTEGER DEFAULT 0,
        returnConfirmedBy TEXT,
        issueType TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        fullName TEXT
    )`, () => {
        const adminPassword = '12345678';
        db.get('SELECT * FROM users WHERE id = 0', (err, row) => {
            if (err) {
                console.error('Database query error:', err.message);
            } else if (!row) {
                bcrypt.hash(adminPassword, saltRounds, (err, hash) => {
                    if (err) {
                        console.error('Error hashing admin password:', err.message);
                    } else {
                        db.run(`INSERT INTO users (id, username, password, role, fullname) VALUES (0, 'admin', ?, 'god', 'admin')`, [hash], (err) => {
                            if (err) {
                                console.error('Error inserting admin user:', err.message);
                            } else {
                                console.log('Admin user created successfully');
                            }
                        });
                    }
                });
            } else {
                console.log('Admin user already exists');
            }
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS journalTypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS medicineTypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS journalNumbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        currentNumber INTEGER
    )`, () => {
        db.get('SELECT * FROM journalNumbers WHERE id = 1', (err, row) => {
            if (err) {
                console.error('Database query error:', err.message);
            } else if (!row) {
                db.run(`INSERT INTO journalNumbers (id, currentNumber) VALUES (1, 0)`, (err) => {
                    if (err) {
                        console.error('Error inserting initial journal number:', err.message);
                    } else {
                        console.log('Initial journal number created successfully');
                    }
                });
            }
        });
    });
}

function checkAuth(req, res, next) {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'god')) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to check if the user has 'god' role
function checkGodRole(req, res, next) {
    if (req.session.user && req.session.user.role === 'god') {
        next();
    } else {
        res.redirect('/login');
    }
}

// Route to render the password reset form
app.get('/reset-password', checkGodRole, (req, res) => {
    res.render('reset-password');
});

// Route to handle password reset form submission
app.post('/reset-password', checkGodRole, (req, res) => {
    const { username, newPassword } = req.body;

    // Check if the user exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else if (!user) {
            res.status(404).send('User not found');
        } else {
            // Hash the new password
            bcrypt.hash(newPassword, saltRounds, (err, hash) => {
                if (err) {
                    console.error('Error hashing new password:', err.message);
                    res.status(500).send('Error hashing new password');
                } else {
                    // Update the user's password in the database
                    db.run('UPDATE users SET password = ? WHERE username = ?', [hash, username], (err) => {
                        if (err) {
                            console.error('Database update error:', err.message);
                            res.status(500).send('Database update error');
                        } else {
                            res.send('Password reset successfully');
                        }
                    });
                }
            });
        }
    });
});

// Функция для генерации следующего номера журнала
function generateNextJournalNumber(callback) {
    db.get('SELECT currentNumber FROM journalNumbers WHERE id = 1', (err, row) => {
        if (err) {
            console.error('Database query error:', err.message);
            return callback(err);
        } else {
            const prefix = 'АЛ'; // Постоянная часть номера
            const currentYear = new Date().getFullYear().toString().slice(-2); // Получаем текущий год (например, 24 для 2024 года)
            const nextNumber = row.currentNumber + 1; // Увеличиваем номер на 1

            const journalNumber = `${prefix}${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

            // Обновляем значение currentNumber в базе данных
            db.run('UPDATE journalNumbers SET currentNumber = ? WHERE id = 1', [nextNumber], (err) => {
                if (err) {
                    console.error('Database update error:', err.message);
                    return callback(err);
                } else {
                    return callback(null, journalNumber);
                }
            });
        }
    });
}

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/issue', (req, res) => {
    db.all('SELECT name FROM journalTypes', (err, journalTypes) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
            return;
        }

        db.all('SELECT name FROM medicineTypes', (err, medicineTypes) => {
            if (err) {
                console.error('Database query error:', err.message);
                res.status(500).send('Database query error');
                return;
            }

            res.render('issue', { journalTypes: journalTypes, medicineTypes: medicineTypes });
        });
    });
});

app.get('/admin', checkAuth, (req, res) => {
    db.all('SELECT * FROM issues', (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            res.render('admin', { issues: rows, username: req.session.user.username });
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login'); // Ensure you have a 'login.ejs' view
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else if (!user) {
            res.status(401).send('Invalid username or password');
        } else {
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords:', err.message);
                    res.status(500).send('Error comparing passwords');
                } else if (result) {
                    req.session.user = user;
                    res.redirect('/admin');
                } else {
                    res.status(401).send('Invalid username or password');
                }
            });
        }
    });
});

app.get('/change-password', checkAuth, (req, res) => {
    res.render('change-password'); // Ensure you have a 'change-password.ejs' view
});

app.post('/change-password', checkAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            bcrypt.compare(oldPassword, user.password, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords:', err.message);
                    res.status(500).send('Error comparing passwords');
                } else if (result) {
bcrypt.hash(newPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing new password:', err.message);
        res.status(500).send('Error hashing new password');
    } else {
        db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], (err) => {
            if (err) {
                console.error('Database update error:', err.message);
                res.status(500).send('Database update error');
            } else {
                res.send('Password changed successfully');
            }
        });
    }
});
                } else {
                    res.status(401).send('Incorrect old password');
                }
            });
        }
    });
});

app.get('/add-admin', checkAuth, (req, res) => {
    res.render('add-admin'); // Ensure you have a 'add-admin.ejs' view
});

app.post('/add-admin', checkAuth, (req, res) => {
    const { username, password, fullName } = req.body;

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err.message);
            return res.status(500).send('Error hashing password');
        }
        
        db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)', [username, hash, 'admin', fullName], (err) => {
            if (err) {
                console.error('Database insert error:', err.message);
                return res.status(500).send('Database insert error');
            }

            res.send('New admin added successfully');
        });            
    });
});

app.post('/issue', (req, res) => {
    const { fullName, issuedBy, journalType, medicineType, additionalInfo } = req.body;

    // Generate the next journal number
    generateNextJournalNumber((err, journalNumber) => {
        if (err) {
            res.status(500).send('Error generating journal number');
        } else {
            // Insert data into the 'issues' table
            db.run(`INSERT INTO issues (fullName, issuedBy, journalType, medicineType, additionalInfo, journalNumber, issueDate, returnConfirmed)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), 0)`,
                    [fullName, issuedBy, journalType, medicineType, additionalInfo, journalNumber],
                    (err) => {
                        if (err) {
                            console.error('Error inserting issue:', err.message);
                            res.status(500).send('Error inserting issue');
                        } else {
                            console.log('Issue inserted successfully');
                            res.redirect('/');
                        }
                    });
        }
    });
});

// Функция для предсказания следующего номера журнала
function predictNextJournalNumber(callback) {
    db.get('SELECT currentNumber FROM journalNumbers WHERE id = 1', (err, row) => {
        if (err) {
            console.error('Database query error:', err.message);
            return callback(err);
        } else {
            const prefix = 'АЛ'; // Постоянная часть номера
            const currentYear = new Date().getFullYear().toString().slice(-2); // Получаем текущий год (например, 24 для 2024 года)
            const nextNumber = row.currentNumber + 1; // Увеличиваем номер на 1

            const journalNumber = `${prefix}${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

            // Вызываем колбэк с предсказанным номером
            return callback(null, journalNumber);
        }
    });
}

// Маршрут для предсказания следующего номера журнала
app.get('/predictNextJournalNumber', (req, res) => {
    predictNextJournalNumber((err, journalNumber) => {
        if (err) {
            res.status(500).send('Error predicting next journal number');
        } else {
            res.send(journalNumber);
        }
    });
});

app.post('/confirmReturn/:id', checkAuth, (req, res) => {
    const issueId = req.params.id;
    const returnConfirmedBy = req.session.user.fullName; // Используем полное имя текущего пользователя

    db.run(`UPDATE issues SET returnDate = datetime('now','localtime'),
                              returnConfirmed = 1,
                              returnConfirmedBy = ?
            WHERE id = ?`,
            [returnConfirmedBy, issueId],
            (err) => {
                if (err) {
                    console.error('Error confirming return:', err.message);
                    res.status(500).send('Error confirming return');
                } else {
                    res.redirect('/admin');
                }
            });
});

app.get('/search', checkAuth, (req, res) => {
    const searchQuery = req.query.search;
    const query = `
        SELECT * FROM issues
        WHERE fullName LIKE ? OR issuedBy LIKE ? OR journalType LIKE ? OR medicineType LIKE ? OR journalNumber LIKE ? OR additionalInfo LIKE ? OR returnDate LIKE ? OR returnConfirmedBy LIKE ?
    `;
    const params = [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`];

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            res.render('admin', { issues: rows });
        }
    });
});

// Маршрут для получения типов журналов
app.get('/getJournalTypes', (req, res) => {
    db.all('SELECT name FROM journalTypes', (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            res.json(rows); // Отправляем список типов журналов в формате JSON
        }
    });
});

// Маршрут для получения лекарственных препаратов
app.get('/getMedicineTypes', (req, res) => {
    db.all('SELECT name FROM medicineTypes', (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            res.json(rows); // Отправляем список лекарственных препаратов в формате JSON
        }
    });
});

app.get('/reset', checkAuth, (req, res) => {
    db.all('SELECT * FROM issues', (err, rows) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
        } else {
            res.render('admin', { issues: rows });
        }
    });
});

// Route to render admin page (requires admin authentication)
app.get('/admin-panel', checkAuth, (req, res) => {
    // Fetch data from journalTypes and medicineTypes tables
    db.all('SELECT * FROM journalTypes', (err, journalTypes) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
            return;
        }

        db.all('SELECT * FROM medicineTypes', (err, medicineTypes) => {
            if (err) {
                console.error('Database query error:', err.message);
                res.status(500).send('Database query error');
                return;
            }

            // Render admin-panel.ejs with fetched data
            res.render('admin-panel', { journalTypes: journalTypes, medicineTypes: medicineTypes });
        });
    });
});

app.get('/admin-panel', checkAuth, (req, res) => {
    db.all('SELECT * FROM journalTypes', (err, journalTypes) => {
        if (err) {
            console.error('Database query error:', err.message);
            res.status(500).send('Database query error');
            return;
        }

        db.all('SELECT * FROM medicineTypes', (err, medicineTypes) => {
            if (err) {
                console.error('Database query error:', err.message);
                res.status(500).send('Database query error');
                return;
            }

            // Combine both sets of data into a single object
            const data = {
                journalTypes: journalTypes,
                medicineTypes: medicineTypes
            };

            // Render admin-panel.ejs with combined data
            res.render('admin-panel', data);
        });
    });
});


// Route to handle adding a new journal type
app.post('/add-journal-type', checkAuth, (req, res) => {
    const { journalTypeName } = req.body;

    db.run('INSERT INTO journalTypes (name) VALUES (?)', [journalTypeName], (err) => {
        if (err) {
            console.error('Error inserting journal type:', err.message);
            res.status(500).send('Error inserting journal type');
        } else {
            res.redirect('/admin-panel'); // Redirect to admin page after insertion
        }
    });
});

// Route to handle adding a new medicine type
app.post('/add-medicine-type', checkAuth, (req, res) => {
    const { medicineTypeName } = req.body;

    db.run('INSERT INTO medicineTypes (name) VALUES (?)', [medicineTypeName], (err) => {
        if (err) {
            console.error('Error inserting medicine type:', err.message);
            res.status(500).send('Error inserting medicine type');
        } else {
            res.redirect('/admin-panel'); // Redirect to admin page after insertion
        }
    });
});

// Route to handle deleting a journal type
app.post('/delete-journal-type/:id', checkAuth, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM journalTypes WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting journal type:', err.message);
            res.status(500).send('Error deleting journal type');
        } else {
            res.redirect('/admin-panel'); // Redirect to admin page after deletion
        }
    });
});

// Route to handle deleting a medicine type
app.post('/delete-medicine-type/:id', checkAuth, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM medicineTypes WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting medicine type:', err.message);
            res.status(500).send('Error deleting medicine type');
        } else {
            res.redirect('/admin-panel'); // Redirect to admin page after deletion
        }
    });
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});