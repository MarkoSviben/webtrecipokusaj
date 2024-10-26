// src/server.ts

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import { Strategy as Auth0Strategy } from 'passport-auth0';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { authCheck } from './authCheck';

dotenv.config();

// Inicijalizacija Prisma klijenta
const prisma = new PrismaClient();

// Kreiranje Express aplikacije
const app = express();
const PORT = process.env.PORT || 3000;

// Postavljanje view enginea
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inicijalizacija session middleware-a
app.use(
  session({
    secret: 'YOUR_SESSION_SECRET', // Zamijenite ovo sigurnom vrijednošću
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000, // Vrijeme trajanja kolačića u milisekundama (ovdje 1 dan)
    },
  })
);

// Inicijalizacija Passport-a i sessiona
app.use(passport.initialize());
app.use(passport.session());

// Konfiguracija Passport Auth0 strategije
const strategy = new Auth0Strategy(
  {
    domain: process.env.AUTH0_DOMAIN!,
    clientID: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    callbackURL: 'http://localhost:3000/callback',
  },
  function (
    accessToken: string,
    refreshToken: string,
    extraParams: any,
    profile: any,
    done: (err: any, user?: any) => void
  ) {
    return done(null, profile);
  }
);

passport.use(strategy);

// Serializacija i deserializacija korisnika
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Middleware za parsiranje tijela zahtjeva
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta za pokretanje autentifikacije
app.get(
  '/login',
  passport.authenticate('auth0', {
    scope: 'openid profile email',
  })
);

// Ruta za povratni poziv nakon autentifikacije
app.get(
  '/callback',
  passport.authenticate('auth0', {
    failureRedirect: '/',
  }),
  (req, res) => {
    res.redirect((req.session as any).returnTo || '/');
  }
);

// Ruta za odjavu
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Greška prilikom odjave:', err);
    }
    res.redirect(
      `https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=http://localhost:3000`
    );
  });
});

// Početna ruta
app.get('/', async (req, res) => {
  try {
    const count = await prisma.ticket.count();
    res.render('index', { count });
  } catch (error) {
    console.error('Greška prilikom dohvaćanja broja ulaznica:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Ruta za kreiranje nove ulaznice s QR kodom
app.post('/create', async (req, res) => {
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
    const existingTickets = await prisma.ticket.count({
      where: { vatin },
    });

    if (existingTickets >= 3) {
      res.status(400).send('Dosegli ste max broj ulaznica s pripadajućim VAT-om.');
      return;
    }

    // Kreiranje nove ulaznice
    const newTicket = await prisma.ticket.create({
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
    const qrCodeDataUrl = await QRCode.toDataURL(ticketUrl);
    console.log('Generirani QR Code Data URL:', qrCodeDataUrl);

    // Renderiranje stranice s QR kodom
    res.render('qr', { qrCodeDataUrl, ticketUrl });
  } catch (error: any) {
    console.error('Greška prilikom kreiranja ulaznice:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Ruta za prikaz informacija o ulaznici pomoću identifikatora (ZAŠTIĆENA)
app.get('/ticket/:id', authCheck, async (req, res) => {
  const { id } = req.params;

  try {
    // Dohvaćanje ulaznice na temelju ID-a
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      res.status(404).send('Ulaznica nije pronađena.');
      return;
    }

    // Renderiranje stranice s informacijama o ulaznici
    res.render('ticket', { ticket, user: req.user });
  } catch (error) {
    console.error('Greška prilikom dohvaćanja ulaznice:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Globalni error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Error Handler:', err);
  res.status(500).send('Internal Server Error');
});

// Pokretanje servera
app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
