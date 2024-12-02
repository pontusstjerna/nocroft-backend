import jwt from 'jsonwebtoken';

export const verifyJWT = (req, res, next) => {
    const header = req.headers.authorization;

    if (header) {
        const splitHeader = header.split(' ');

        if (splitHeader[0] === 'bearer') {
            const token = splitHeader[1];

            verifyJWT(token).then(decodedToken => {
                req.user = decodedToken.data;
                next();
            }).catch(err => {
                res.status(401).send("Unauthorized: " + err.message);
            });
        } else {
            res.status(400).send("Invalid authorization header.");
        }
    } else {
        res.status(400).send("Unauthorized (no authorization header).");
    }
}

export const verifyJWT = token => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
            if (err || !decodedToken) {
                return reject(err);
            }

            resolve(decodedToken);
        })
    })
}

export const createJWT = (options) => {
    if (typeof options !== 'object') {
        options = {};
    }

    let { maxAge, sessionData } = options;

    if (!maxAge) {
        maxAge = 3600; // 1 hour
    }

    const token = jwt.sign(
        {
            data: sessionData
        },
        process.env.JWT_SECRET,
        {
            expiresIn: maxAge,
            algorithm: 'HS256'
        }
    );

    return token;
}