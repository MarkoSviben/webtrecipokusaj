// src/server.ts

import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import path from 'path';
import QRCode from 'qrcode'; // Provjera importa

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// Ruta za prikaz informacija o ulaznici pomoću identifikatora
app.get('/ticket/:id', async (req, res) => {
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
    res.render('ticket', { ticket });
  } catch (error) {
    console.error('Greška prilikom dohvaćanja ulaznice:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Globalni error handler (dodatno za dijagnostiku)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Error Handler:', err);
  res.status(500).send('Internal Server Error');
});

// Pokretanje servera
app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
