import btoa from 'btoa';

const username = process.argv[2];
const password = process.argv[3];

const authorize = header => {
    const splitHeader = header.split(' ');
    if (splitHeader[0] !== 'basic') {
        return false;
    }

    if (splitHeader[1] !== btoa(`${username}:${password}`)) {
        return false;
    }

    return true;
}

export default ((req, res) => {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader || !authorize(authorizationHeader)) {
        res.status(401).send("Unauthorized access.");
        return;
    }

    res.sendStatus(200);
});