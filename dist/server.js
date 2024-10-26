"use strict";
// src/server.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const passport_auth0_1 = require("passport-auth0");
const client_1 = require("@prisma/client");
const qrcode_1 = __importDefault(require("qrcode"));
const authCheck_1 = require("./authCheck");
dotenv_1.default.config();
// Inicijalizacija Prisma klijenta
const prisma = new client_1.PrismaClient();
// Kreiranje Express aplikacije
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Postavljanje view enginea
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(__dirname, 'views'));
// Middleware za parsiranje tijela zahtjeva
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Inicijalizacija session middleware-a
app.use((0, express_session_1.default)({
    secret: 'YOUR_SESSION_SECRET',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 86400000, // Vrijeme trajanja kolačića u milisekundama (ovdje 1 dan)
    },
}));
// Inicijalizacija Passport-a i sessiona
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Konfiguracija Passport Auth0 strategije
const strategy = new passport_auth0_1.Strategy({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/callback`, // Dinamički URL
}, function (accessToken, refreshToken, extraParams, profile, done) {
    return done(null, profile);
});
passport_1.default.use(strategy);
// Serializacija i deserializacija korisnika
passport_1.default.serializeUser((user, done) => {
    done(null, user);
});
passport_1.default.deserializeUser((user, done) => {
    done(null, user);
});
// Ruta za pokretanje autentifikacije
app.get('/login', passport_1.default.authenticate('auth0', {
    scope: 'openid profile email',
}));
// Ruta za povratni poziv nakon autentifikacije
app.get('/callback', passport_1.default.authenticate('auth0', {
    failureRedirect: '/',
}), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
// Ruta za odjavu
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Greška prilikom odjave:', err);
        }
        res.redirect(`https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${process.env.BASE_URL}`);
    });
});
// Početna ruta
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield prisma.ticket.count();
        res.render('index', { count, user: req.user });
    }
    catch (error) {
        console.error('Greška prilikom dohvaćanja broja ulaznica:', error);
        res.status(500).send('Internal Server Error');
    }
}));
// Ruta za kreiranje nove ulaznice s QR kodom (ZAŠTIĆENA)
app.post('/create', authCheck_1.authCheck, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vatin, firstName, lastName } = req.body;
    // Validacija podataka
    if (!vatin || !firstName || !lastName) {
        res.status(400).send('Sva polja su obavezna.');
        return;
    }
    // Provjera dužine unosa
    if (vatin.length > 11) {
        res.status(400).send('VATIN ne smije biti duži od 11 znakova.');
        return;
    }
    if (firstName.length > 100) {
        res.status(400).send('Ime ne smije biti duže od 100 znakova.');
        return;
    }
    if (lastName.length > 100) {
        res.status(400).send('Prezime ne smije biti duže od 100 znakova.');
        return;
    }
    console.log('Kreiranje ulaznice s podacima:', { vatin, firstName, lastName });
    try {
        // Provjera broja ulaznica za dati VATIN
        const existingTickets = yield prisma.ticket.count({
            where: { vatin },
        });
        if (existingTickets >= 3) {
            res.status(400).send('Dosegli ste max broj ulaznica s pripadajućim VAT-om.');
            return;
        }
        // Kreiranje nove ulaznice
        const newTicket = yield prisma.ticket.create({
            data: {
                vatin,
                firstName,
                lastName,
            },
        });
        console.log('Kreirana nova ulaznica:', newTicket);
        // Generiranje URL-a za ulaznicu
        const ticketUrl = `http://localhost:${PORT}/ticket/${newTicket.id}`;
        console.log('Generirani URL za ulaznicu:', ticketUrl);
        // Generiranje QR koda
        const qrCodeDataUrl = yield qrcode_1.default.toDataURL(ticketUrl);
        console.log('Generirani QR Code Data URL:', qrCodeDataUrl);
        // Renderiranje stranice s QR kodom
        res.render('qr', { qrCodeDataUrl, ticketUrl });
    }
    catch (error) {
        console.error('Greška prilikom kreiranja ulaznice:', error);
        res.status(500).send('Internal Server Error');
    }
}));
// Ruta za prikaz informacija o ulaznici pomoću identifikatora (ZAŠTIĆENA)
app.get('/ticket/:id', authCheck_1.authCheck, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Dohvaćanje ulaznice na temelju ID-a
        const ticket = yield prisma.ticket.findUnique({
            where: { id },
        });
        if (!ticket) {
            res.status(404).send('Ulaznica nije pronađena.');
            return;
        }
        // Renderiranje stranice s informacijama o ulaznici
        res.render('ticket', { ticket, user: req.user });
    }
    catch (error) {
        console.error('Greška prilikom dohvaćanja ulaznice:', error);
        res.status(500).send('Internal Server Error');
    }
}));
// Globalni error handler
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err);
    res.status(500).send('Internal Server Error');
});
// Pokretanje servera
app.listen(PORT, () => {
    console.log(`Server radi na http://localhost:${PORT}`);
});
