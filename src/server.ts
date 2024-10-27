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


const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'YOUR_SESSION_SECRET', 
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000, // 1 dan
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const strategy = new Auth0Strategy(
  {
    domain: process.env.AUTH0_DOMAIN!,
    clientID: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    callbackURL: `${process.env.BASE_URL}/callback`, // Dinamički URL
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

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

app.get(
  '/login',
  passport.authenticate('auth0', {
    scope: 'openid profile email',
  })
);

app.get(
  '/callback',
  passport.authenticate('auth0', {
    failureRedirect: '/',
  }),
  (req, res) => {
    res.redirect(req.session.returnTo || '/');
  }
);

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Greška prilikom odjave:', err);
    }
    res.redirect(
      `https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${process.env.BASE_URL}`
    ); 
  });
});

app.get('/', async (req, res) => {
  try {
    const count = await prisma.ticket.count();
    res.render('index', { count, user: req.user });
  } catch (error) {
    console.error('Greška prilikom dohvaćanja broja ulaznica:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/create', authCheck, async (req, res) => {
  const { vatin, firstName, lastName } = req.body;

  if (!vatin || !firstName || !lastName) {
    res.status(400).send('Sva polja su obavezna.');
    return;
  }

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
    const existingTickets = await prisma.ticket.count({
      where: { vatin },
    });

    if (existingTickets >= 3) {
      res.status(400).send('Dosegli ste max broj ulaznica s pripadajućim VAT-om.');
      return;
    }

    const newTicket = await prisma.ticket.create({
      data: {
        vatin,
        firstName,
        lastName,
      },
    });

    console.log('Kreirana nova ulaznica:', newTicket);

    const ticketUrl = `${process.env.BASE_URL}/ticket/${newTicket.id}`;
    console.log('Generirani URL za ulaznicu:', ticketUrl);

    const qrCodeDataUrl = await QRCode.toDataURL(ticketUrl);
    console.log('Generirani QR Code Data URL:', qrCodeDataUrl);

    res.render('qr', { qrCodeDataUrl, ticketUrl });
  } catch (error: any) {
    console.error('Greška prilikom kreiranja ulaznice:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/ticket/:id', authCheck, async (req, res) => {
  const { id } = req.params;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      res.status(404).send('Ulaznica nije pronađena.');
      return;
    }

    res.render('ticket', { ticket, user: req.user });
  } catch (error) {
    console.error('Greška prilikom dohvaćanja ulaznice:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Error Handler:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`Server radi na ${process.env.BASE_URL}`);
});
