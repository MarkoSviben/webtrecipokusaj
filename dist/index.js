"use strict";
// src/index.ts
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
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
dotenv_1.default.config();
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Provjera veze s bazom podataka
        yield prisma.$connect();
        console.log('Uspješno povezan s bazom podataka.');
        // Kreiranje testnog zapisa
        const newTicket = yield prisma.ticket.create({
            data: {
                vatin: '12345678901',
                firstName: 'Ivan',
                lastName: 'Horvat',
            },
        });
        console.log('Kreiran novi tiket:', newTicket);
    }
    catch (error) {
        console.error('Greška prilikom povezivanja s bazom podataka:', error);
    }
    finally {
        yield prisma.$disconnect();
    }
});
main();
