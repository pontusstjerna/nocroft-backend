import jwt from 'jsonwebtoken';

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