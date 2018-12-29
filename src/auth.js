import { verifyJWT, createJWT } from './jwt.js';
import btoa from 'btoa';

const authorizeUserPassword = userPassword => {
    const maybeUser = process.env.USERS.split(';').find(config =>  userPassword === btoa(config));

    if (!maybeUser) {
        return false;
    }

    // Return the users username
    return maybeUser.split(':')[0];
}

export default ((req, res) => {
    const user = authorizeUserPassword(req.body);

    if (!user) {
        res.status(401).send("Invalid username or password.");
        return;
    }

    const token = createJWT({
        sessionData: user,
        maxAge: 30,
    });

    res.status(200).json(token);
});