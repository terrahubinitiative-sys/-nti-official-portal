require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'nti_etl10_vanguard_secret_key_2026_secure';
const ETL10_MASTER_KEY = process.env.ETL10_MASTER_KEY || 'ETL10_NTI_2026_MASTER_KEY';

// Hardcoded fallback URL to prevent crashes if .env fails to load
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qmlsfmothmcctinxlqb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'dummy_key';

let supabase;
if (SUPABASE_URL && SUPABASE_KEY !== 'dummy_key') {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized Successfully.");
} else {
    console.warn("WARNING: SUPABASE_KEY missing. Please configure your .env or Render Environment Variables.");
    supabase = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy');
}

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

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.render('login', { error: 'Please enter both phone number and password.' });
    }

    const { data: member } = await supabase.from('members').select('*').eq('phone', phone).single();

    if (!member || member.password !== password) {
        return res.render('login', { error: 'Invalid Phone Number or Password.' });
    }

    if (member.isBanned) {
        return res.send("<h1 style='color:red; text-align:center;'>YOUR ACCOUNT HAS BEEN BANNED BY NTI SYSTEM ADMINS.</h1>");
    }

    req.session.memberId = member.id;

    if (member.englishStatus === 'PASSED') {
        return res.redirect(`/member-dashboard?memberId=${member.id}`);
    } else if (member.cooldownUntil && new Date() < new Date(member.cooldownUntil)) {
        return res.redirect(`/remedial-hub?memberId=${member.id}`);
    } else {
        return res.redirect(`/english-test?memberId=${member.id}`);
    }
});

app.get('/logout', (req, res) => {
    req.session.memberId = null;
    res.redirect('/login');
});

app.get('/register', (req, res) => {
    res.render('register', { professions: techProfessions, error: null });
});

app.post('/register', async (req, res) => {
    const { fullName, phone, location, profession, visionStatement, password } = req.body;
    if (!fullName || !phone || !profession || !password) {
        return res.render('register', { professions: techProfessions, error: 'Please fill all required fields.' });
    }

    const { data: existing } = await supabase.from('members').select('id').eq('phone', phone).single();
    if (existing) {
        return res.render('register', { professions: techProfessions, error: 'Phone number already registered. Please login instead.' });
    }

    const { data: members } = await supabase.from('members').select('id');
    const memberId = `NTI-MBR-${String((members ? members.length : 0) + 1).padStart(4, '0')}`;

    const newMember = {
        id: memberId, fullName, phone, location, profession, visionStatement, password,
        registeredAt: new Date().toISOString(),
        englishStatus: 'PENDING', score: 0, tabSwitches: 0, attemptsCount: 0,
        isBanned: false, cooldownUntil: null
    };

    const { error } = await supabase.from('members').insert([newMember]);

    if (error) {
        console.error("Supabase Insert Error:", error.message);
        return res.render('register', { professions: techProfessions, error: 'Registration failed in cloud database.' });
    }

    req.session.memberId = memberId;
    res.redirect(`/english-test?memberId=${memberId}`);
});

app.get('/english-test', async (req, res) => {
    const memberId = req.query.memberId || req.session.memberId;
    if (!memberId) return res.redirect('/login');

    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();

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

app.post('/submit-test', async (req, res) => {
    const { memberId, userAnswers, disqualified, tabSwitches } = req.body;
    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();

    if (!member) return res.redirect('/register');

    const newAttempts = (member.attemptsCount || 0) + 1;
    const switches = parseInt(tabSwitches) || 0;
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + 10);

    if (disqualified === 'true') {
        await supabase.from('members').update({
            englishStatus: 'FAILED_CHEATING', score: 0, tabSwitches: switches,
            attemptsCount: newAttempts, cooldownUntil: cooldownDate.toISOString()
        }).eq('id', memberId);

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

    if (percentage >= 80) {
        await supabase.from('members').update({
            englishStatus: 'PASSED', score: percentage, tabSwitches: switches,
            attemptsCount: newAttempts, cooldownUntil: null
        }).eq('id', memberId);
    } else {
        await supabase.from('members').update({
            englishStatus: 'REMEDIAL_REQUIRED', score: percentage, tabSwitches: switches,
            attemptsCount: newAttempts, cooldownUntil: cooldownDate.toISOString()
        }).eq('id', memberId);
    }

    res.redirect(percentage >= 80 ? `/member-dashboard?memberId=${memberId}` : `/remedial-hub?memberId=${memberId}`);
});

app.get('/remedial-hub', async (req, res) => {
    const memberId = req.query.memberId || req.session.memberId;
    if (!memberId) return res.redirect('/login');

    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();
    if (!member) return res.redirect('/register');
    res.render('remedial-hub', { member });
});

app.get('/member-dashboard', async (req, res) => {
    const memberId = req.query.memberId || req.session.memberId;
    if (!memberId) return res.redirect('/login');

    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();
    if (!member) return res.redirect('/login');
    if (member.isBanned) return res.send("<h1 style='color:red; text-align:center;'>YOUR ACCOUNT HAS BEEN BANNED BY NTI SYSTEM ADMINS.</h1>");

    const { data: allMembers } = await supabase.from('members').select('*');
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    const { data: resources } = await supabase.from('resources').select('*');

    res.render('member-dashboard', { 
        member, 
        allMembers: allMembers || [], 
        announcements: announcements || [],
        resources: resources || [] 
    });
});

// Secret Admin Panel
const SECRET_ADMIN_ROUTE = "/etl10-vanguard-core-access-2026-secure";

app.get(SECRET_ADMIN_ROUTE, async (req, res) => {
    if (!req.session.isAdmin) {
        return res.render('admin-login', { secretRoute: SECRET_ADMIN_ROUTE, error: null });
    }
    const { data: members } = await supabase.from('members').select('*');
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    const { data: resources } = await supabase.from('resources').select('*');

    res.render('admin-panel', { 
        secretRoute: SECRET_ADMIN_ROUTE, 
        members: members || [], 
        announcements: announcements || [],
        resources: resources || [] 
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

app.post(`${SECRET_ADMIN_ROUTE}/toggle-ban`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { memberId } = req.body;
    const { data: member } = await supabase.from('members').select('isBanned').eq('id', memberId).single();
    if (member) {
        await supabase.from('members').update({ isBanned: !member.isBanned }).eq('id', memberId);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/reset-cooldown`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { memberId } = req.body;
    await supabase.from('members').update({ cooldownUntil: null, englishStatus: 'PENDING' }).eq('id', memberId);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/broadcast`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { title, content } = req.body;
    const date = new Date().toISOString().split('T')[0];
    if (title && content) {
        await supabase.from('announcements').insert([{ date, title, content }]);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/add-resource`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { title, url } = req.body;
    if (title && url) {
        await supabase.from('resources').insert([{ id: `RES-${Date.now()}`, title, url }]);
    }
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/edit-resource`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { id, title, url } = req.body;
    await supabase.from('resources').update({ title, url }).eq('id', id);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.post(`${SECRET_ADMIN_ROUTE}/delete-resource`, async (req, res) => {
    if (!req.session.isAdmin) return res.redirect(SECRET_ADMIN_ROUTE);
    const { id } = req.body;
    await supabase.from('resources').delete().eq('id', id);
    res.redirect(SECRET_ADMIN_ROUTE);
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` NTI PORTAL ONLINE WITH SAFE SUPABASE CLIENT `);
    console.log(` Public Home: http://localhost:${PORT}`);
    console.log(` Login Gateway: http://localhost:${PORT}/login`);
    console.log(`====================================================`);
});
