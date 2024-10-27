// src/authCheck.ts
import { SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
  }
}
import { Request, Response, NextFunction } from 'express';

export const authCheck = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  req.session.returnTo = req.originalUrl; 
  res.redirect('/login');
};
