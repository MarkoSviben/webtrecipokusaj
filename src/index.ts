// src/index.ts

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

dotenv.config();

const main = async () => {
  try {
    
    await prisma.$connect();
    console.log('Uspješno povezan s bazom podataka.');

    
    const newTicket = await prisma.ticket.create({
      data: {
        vatin: '12345678901',
        firstName: 'Ivan',
        lastName: 'Horvat',
      },
    });

  } catch (error) {
    console.error('Greška prilikom povezivanja s bazom podataka:', error);
  } finally {
    await prisma.$disconnect();
  }
};

main();
