"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authCheck = void 0;
const authCheck = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    req.session.returnTo = req.originalUrl; // Ovdje TypeScript treba prepoznati 'returnTo'
    res.redirect('/login');
};
exports.authCheck = authCheck;
