require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback_secret';
const ETL10_MASTER_KEY = process.env.ETL10_MASTER_KEY || 'FALLBACK_KEY';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// PURE JS PERSISTENCE ENGINE (db.json)
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { members: [], announcements: [], resources: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.resources) db.resources = [];
    return db;
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const englishQuestions = [
    { id: 1, question: "Identify the grammatically correct sentence:", options: ["She don't like reading books.", "She doesn't likes reading books.", "She doesn't like reading books.", "She not like reading books."], answer: 2 },
    { id: 2, question: "Choose the correct pronoun: 'Neither Ezra nor Brian brought _____ laptop.'", options: ["their", "his", "they", "them"], answer: 1 },
    { id: 3, question: "What is the primary objective of NTI's 'Basics First' pillar?", options: ["Jump directly into Python without logic", "Master English and logic before coding", "Buy expensive laptops immediately", "Avoid daily study schedules"], answer: 1 },
    { id: 4, question: "Select the correctly punctuated sentence:", options: ["Let's eat, Ezra!", "Lets eat Ezra!", "Let's eat Ezra.", "Lets, eat Ezra!"], answer: 0 },
    { id: 5, question: "Which word is a synonym for 'Perseverance'?", options: ["Lazy", "Persistence", "Weakness", "Hesitation"], answer: 1 },
    { id: 6, question: "Complete the sentence: 'If a student _____ daily study blocks, they will make fast progress.'", options: ["maintains", "maintain", "maintaining", "maintained"], answer: 0 },
    { id: 7, question: "What is the antonym of 'Obsolete'?", options: ["Outdated", "Modern", "Ancient", "Old"], answer: 1 },
    { id: 8, question: "Choose the correct spelling:", options: ["Committment", "Commitment", "Comitment", "Committmentt"], answer: 1 },
    { id: 9, question: "Fill in the blank: 'The student was accredited _____ completing the assessment.'", options: ["after", "before", "during", "while"], answer: 0 },
    { id: 10, question: "Which passive voice sentence is correct?", options: ["The code was written by the developer.", "The code wrote the developer.", "The developer was written the code.", "The code write by developer."], answer: 0 },
    { id: 11, question: "Logic Check: 'All developers use terminals. Ezra is a developer.' Therefore:", options: ["Ezra uses a terminal.", "Ezra does not use a terminal.", "Terminals develop Ezra.", "None of the above."], answer: 0 },
    { id: 12, question: "Identify the conjunction in this sentence: 'Study hard or you will lag behind.'", options: ["Study", "hard", "or", "behind"], answer: 2 },
    { id: 13, question: "Select the word that best fits: 'To succeed in self-learning, one must cultivate _____.'", options: ["idleness", "discipline", "distraction", "excuses"], answer: 1 },
    { id: 14, question: "What does 'Execution Over Excuses' imply?", options: ["Action produces results, not reasons", "Giving excuses is allowed", "Wait for someone to help you", "Avoid taking action"], answer: 0 },
    { id: 15, question: "Choose the correct preposition: 'Focus _____ your goals every day.'", options: ["in", "on", "at", "with"], answer: 1 }
];

const techProfessions = [
    "Cybersecurity Specialist", "IT Support & Network Administrator", "Python Developer",
    "Full-Stack Web Developer", "Database & Backend Engineer", "Data Analyst",
    "AI & Automation Specialist", "Machine Learning Engineer", "Digital Marketer", "Technical Project Manager"
];

// Public Routes
app.get('/', (req, res) => res.render('index'));

app.get('/register', (req, res) => {
    res.render('register', { professions: techProfessions, error: null });
});

app.post('/register', (req, res) => {
    const { fullName, phone, location, profession, visionStatement, password } = req.body;
    if (!fullName || !phone || !profession || !password) {
        return res.render('register', { professions: techProfessions, error: 'Please fill all required fields.' });
    }

    const db = loadDB();
    const memberId = `NTI-MBR-${String(db.members.length + 1).padStart(4, '0')}`;
    
    const newMember = {
        id: memberId, fullName, phone, location, profession, visionStatement, password,
        registeredAt: new Date().toISOString(),
        englishStatus: 'PENDING', score: 0, tabSwitches: 0, attemptsCount: 0,
        isBanned: false, cooldownUntil: null
    };

    db.members.push(newMember);
    saveDB(db);

    res.redirect(`/english-test?memberId=${memberId}`);
});

app.get('/english-test', (req, res) => {
    const memberId = req.query.memberId;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);

    if (!member) return res.redirect('/register');
    if (member.isBanned) return res.send("<h1 style='color:red; text-align:center;'>YOUR ACCOUNT HAS BEEN BANNED BY NTI SYSTEM ADMINS.</h1>");
    if (member.cooldownUntil && new Date() < new Date(member.cooldownUntil)) {
        return res.redirect(`/remedial-hub?memberId=${memberId}`);
    }
    if (member.englishStatus === 'PASSED') {
        return res.redirect(`/member-dashboard?memberId=${memberId}`);
    }

    res.render('english-test', { member, questions: englishQuestions });
});

app.post('/submit-test', (req, res) => {
    const { memberId, userAnswers, disqualified, tabSwitches } = req.body;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);

    if (!member) return res.redirect('/register');

    member.attemptsCount = (member.attemptsCount || 0) + 1;
    member.tabSwitches = parseInt(tabSwitches) || 0;

    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + 10);

    if (disqualified === 'true') {
        member.englishStatus = 'FAILED_CHEATING';
        member.score = 0;
        member.cooldownUntil = cooldownDate.toISOString();
        saveDB(db);
        return res.redirect(`/remedial-hub?memberId=${memberId}`);
    }

    let correctCount = 0;
    const parsedAnswers = userAnswers ? JSON.parse(userAnswers) : {};

    englishQuestions.forEach(q => {
        if (parsedAnswers[q.id] !== undefined && parseInt(parsedAnswers[q.id]) === q.answer) {
            correctCount++;
        }
    });

    const percentage = Math.round((correctCount / englishQuestions.length) * 100);
    member.score = percentage;

    if (percentage >= 80) {
        member.englishStatus = 'PASSED';
        member.cooldownUntil = null;
    } else {
        member.englishStatus = 'REMEDIAL_REQUIRED';
        member.cooldownUntil = cooldownDate.toISOString();
    }

    saveDB(db);
    res.redirect(percentage >= 80 ? `/member-dashboard?memberId=${memberId}` : `/remedial-hub?memberId=${memberId}`);
});

app.get('/remedial-hub', (req, res) => {
    const memberId = req.query.memberId;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);
    if (!member) return res.redirect('/register');
    res.render('remedial-hub', { member });
});

app.get('/member-dashboard', (req, res) => {
    const memberId = req.query.memberId;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);
    if (!member) return res.redirect('/register');
    if (member.isBanned) return res.send("<h1 style='color:red; text-align:center;'>YOUR ACCOUNT HAS BEEN BANNED BY NTI SYSTEM ADMINS.</h1>");

    res.render('member-dashboard', { 
        member, 
        allMembers: db.members, 
        announcements: db.announcements,
        resources: db.resources 
    });
});

// Secret Admin Panel
const SECRET_ADMIN_ROUTE = "/etl10-vanguard-core-access-2026-secure";

app.get(SECRET_ADMIN_ROUTE, (req, res) => {
    if (!req.session.isAdmin) {
        return res.render('admin-login', { secretRoute: SECRET_ADMIN_ROUTE, error: null });
    }
    const db = loadDB();
    res.render('admin-panel', { 
        secretRoute: SECRET_ADMIN_ROUTE, 
        members: db.members, 
        announcements: db.announcements,
        resources: db.resources 
    });
});

app.post(`${SECRET_ADMIN_ROUTE}/login`, (req, res) => {
    const { masterKey } = req.body;
    if (masterKey === ETL10_MASTER_KEY) {
        req.session.isAdmin = true;
        return res.redirect(SECRET_ADMIN_ROUTE);
    }
    res.render('admin-login', { secretRoute: SECRET_ADMIN_ROUTE, error: 'Invalid Master Security Key!' });
});

app.get(`${SECRET_ADMIN_ROUTE}/logout`, (req, res) => {
    req.session.isAdmin = false;
    res.redirect('/');
});

app.post(`${SECRET_ADMIN_ROUTE}/toggle-ban`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { memberId } = req.body;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);
    if (member) member.isBanned = !member.isBanned;
    saveDB(db);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/reset-cooldown`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { memberId } = req.body;
    const db = loadDB();
    const member = db.members.find(m => m.id === memberId);
    if (member) {
        member.cooldownUntil = null;
        member.englishStatus = 'PENDING';
    }
    saveDB(db);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/broadcast`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { title, content } = req.body;
    const db = loadDB();
    if (title && content) {
        db.announcements.unshift({
            id: db.announcements.length + 1,
            date: new Date().toISOString().split('T')[0],
            title, content
        });
        saveDB(db);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/add-resource`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { title, url } = req.body;
    const db = loadDB();
    if (title && url) {
        db.resources.unshift({
            id: `RES-${Date.now()}`,
            title, url
        });
        saveDB(db);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/edit-resource`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { id, title, url } = req.body;
    const db = loadDB();
    const resItem = db.resources.find(r => r.id === id);
    if (resItem) {
        resItem.title = title;
        resItem.url = url;
        saveDB(db);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/delete-resource`, (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { id } = req.body;
    const db = loadDB();
    db.resources = db.resources.filter(r => r.id !== id);
    saveDB(db);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` NTI PORTAL ONLINE (ENV SECURED)`);
    console.log(` Public Home: http://localhost:${PORT}`);
    console.log(` Secret Admin: http://localhost:${PORT}${SECRET_ADMIN_ROUTE}`);
    console.log(`====================================================`);
});
