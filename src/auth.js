import { verifyJWT, createJWT, verifyJWT_MW} from './jwt.js';
import btoa from 'btoa';

const authorizeUserPassword = userPassword => {
    const maybeUser = process.env.USERS.split(';').find(config =>  userPassword === btoa(config));

    if (!maybeUser) {
        return false;
    }

    // Return the users username
    return maybeUser.split(':')[0];
}

export const login = ((req, res) => {
    const user = authorizeUserPassword(req.body);

    if (!user) {
        res.status(401).send("Invalid username or password.");
        return;
    }

    const token = createJWT({
        sessionData: user,
        maxAge: 600,
    });

    res.status(200).send(token);
});

export const checkSocketAuthorized = req => {
    const authHeader = req.headers.authorization;

    return new Promise(resolve => {
        if (authHeader) {
            const splitHeader = authHeader.split(' ');

            if (splitHeader[0] === 'bearer') {
                const token = splitHeader[1];

                verifyJWT(token).then(decodedToken => {
                    req.user = decodedToken.data;
                }).catch(err => {
                    resolve({authorized: false, code: 401, status: "Unauthorized: " + err.message});
                }).then(() => resolve({authorized: true, code: 200, status: 'OK'}));
            } else {
                resolve({authorized: false, code: 400, status: 'Invalid authorization header.'});
            }
        } else {
            resolve({authorized: false, code: 400, status: 'Unauthorized (no authorization header).'});
        }
    });
};

export const checkLogin = ((req, res) => {
    res.status(200).send(`Welcome ${req.user}, I have missed you. This is the backend calling. :)`);
});

export const getAccessToken = ((req, res) => {
    verifyJWT_MW(req, res, () => res.status(200).send(createJWT({maxAge: 2, sessionData: req.user})));
});